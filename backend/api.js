const dotenv = require("dotenv");
const { Client } = require("basic-ftp");
const { MongoClient } = require("mongodb");
const { PassThrough } = require('node:stream');
const cors = require('cors')
const { inspect } = require ('node:util');
const express = require('express');
const { downloadTo } = require("basic-ftp/dist/transfer");
dotenv.config();

const app = express()
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
//KNOWN BUGS:
//IF DATABASE IS DESTROYED WHILE PROGRAM IS RUNNING, IT CAUSES A CRASH ON NEXT QUERY


const GetMusicMetadata = async (path, metadataExists, {mongodb, collection}) => {
    if(metadataExists === null ){
        //only import the parser if the metadata does not exist yet 
        const { parseStream } = await import("music-metadata");
        // Download music file from FTP server
        const { stream, client, size } = await DownloadMusic(path);
        try {
            // Parse the music file stream to extract metadata
            const metadata = await parseStream(stream, { size }, { skipCovers: true });
            // Store metadata in MongoDB database
            await collection.insertOne({ path, ...{'common':metadata.common, 'format':metadata.format} });
            return {'common':metadata.common, 'format':metadata.format};
        }
        catch(err){
            //if err then destroy the stream and log the error
            stream.destroy(); 
            console.error(err);
        }
    }
    else{
        metadata=metadataExists
        return {'common':metadata.common, 'format':metadata.format};
    }
    
}


const ListMusic = async () => {
    let MusicIndexes = {};
    const client = new Client(30000);
    const mongodb = new MongoClient(process.env.DB_HOST, {auth: {username: process.env.DB_USER,password: process.env.DB_PASSWORD},authSource: "metadatadb"});
    try {
        await client.access({host: process.env.MUSIC_DB_HOST,user: process.env.MUSIC_DB_USER,password: process.env.MUSIC_DB_PASSWORD,secure: "implicit",secureOptions: {rejectUnauthorized: false}});
        await mongodb.connect();
        await client.cd("./music/musicapp");
        const currentPath = await client.pwd();
        const list = await client.list(".");
        let i=0;
        //for each file in the music directory, get the metadata and store it in the music indexes obj
        for (const file of list) {
            i++
            let metadata={}

            try{
                const db = mongodb.db("metadatadb")
                const collection = db.collection("metadata")
                const metadataExists = await collection.findOne({ path: currentPath + "/" + file.name })
                metadata = await GetMusicMetadata(currentPath + "/" + file.name, metadataExists, {mongodb, collection})
            }
            catch(err){
                console.log(file.name, err)
            }

            MusicIndexes[i] = {
                name: file.name,
                path: currentPath + "/" + file.name,
                metadata: metadata
            }
        }   
    } 
    catch(err) {console.error(err);} 
    finally{
        mongodb.close()
        client.close()
    }
    return MusicIndexes;
};

const DownloadMusic = async (path) => {
    const client = new Client(30000);
    try {
        await client.access({host: process.env.MUSIC_DB_HOST,user: process.env.MUSIC_DB_USER,password: process.env.MUSIC_DB_PASSWORD,secure: "implicit",secureOptions: {rejectUnauthorized: false}});
        //file directory should look like this: /music/musicapp/songname/songname_orreallyanything.mp3, so we need to list the files in the songname directory and download the first file (the mp3 file)
        const files = await client.list(path);
        const filepath = `${path}/${files[0].name}`;

        //create passthrough stream to download the file
        const stream = new PassThrough();
        const downloadPromise = client.downloadTo(stream, filepath);

        downloadPromise.catch(err => {
            //if the download fails destroy the stream and close the client, then throw the error
            stream.destroy(err)
            client.close()
            throw err
        });
        downloadPromise.finally(() => client.close()).catch(() => {});
        return { stream, client };
    }catch(err){
        client.close();
        throw err;
    }
}


app.get('/api/musiclist', async (res) =>{
    await ListMusic().then(((indexes) => {
        return res.status(200).send(indexes)
    }))
})
app.post('/api/downloadMusic', async (req, res) => {

    const index = req.body?.index;
    try{
        let indexes=await ListMusic()
        let {stream, client} = await DownloadMusic(indexes[index].path)
    }
    catch(err){
        console.log(err)
    }
    finally{
        client.close()
    }

    
});

app.listen(process.env.WEBSITEPORT)

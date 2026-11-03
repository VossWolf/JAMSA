const dotenv = require("dotenv");
const { Client } = require("basic-ftp");
const { MongoClient } = require("mongodb");
const { PassThrough } = require('node:stream');
const { inspect } = require ('node:util');
const express = require('express')
dotenv.config();

const app = express()
app.use(express.json({
  limit: '1mb',        
  strict: true,         
  type: 'application/json', 
}))

const GetMusicMetadata = async (path, metadataExists, {mongodb, collection}) => {
    if(!metadataExists === null ){
        const { parseStream } = await import("music-metadata");
        const { stream, client, size } = await DownloadMusic(path);
        try {
            const metadata = await parseStream(stream, { size }, { skipCovers: true });
            await collection.insertOne({ path, ...metadata });
            
            return {'genre': metadata.common.genre[0], 'album':metadata.common.album, 'title':metadata.common.title, 'artist':metadata.common.artist, 'artists':metadata.common.artists};
        }
        catch(err){
            stream.destroy(); 
            console.error(err);
        }
        finally{
            client.close()
            mongodb.close()
        }
    }
    else{
        try{
            const metadata = await collection.findOne({"path":path}) 
            return {'genre': metadata.common.genre[0], 'album':metadata.common.album, 'title':metadata.common.title, 'artist':metadata.common.artist, 'artists':metadata.common.artists};

        }catch(err){
            console.error(err)
        }
        finally{
            mongodb.close()
        }
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
        for (const file of list) {
            i++
            let metadata={}
            try{
                const db = mongodb.db("metadatadb")
                const collection = db.collection("metadata")
                const metadataExists = await collection.findOne({ path: currentPath + "/" + file.name })
                metadata = await GetMusicMetadata(currentPath + "/" + file.name, metadataExists, {mongodb, collection})
            }catch(err){
                console.log(file.name, err)
            }

            MusicIndexes[i] = {
                name: file.name,
                path: currentPath + "/" + file.name,
                metadata: metadata
            }
        }   
    } catch(err) {
        console.error(err);
    } 
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
        const files = await client.list(path);
        const filepath = `${path}/${files[0].name}`;
        const stream = new PassThrough();
        const downloadPromise = client.downloadTo(stream, filepath);
        downloadPromise.catch(err => {
            stream.destroy(err)
            client.close()
            return
        });
        downloadPromise.finally(() => client.close()).catch(() => {});
        return { stream, client };
    }
    catch(err){
        client.close();
        throw err;
    }
}


app.post('/api/musiclist', async (req, res) =>{
    res.header("Access-Control-Allow-Origin", "null"); 
    res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Private-Network", "true");
  
    await ListMusic().then(((indexes) => {
        console.log(inspect(indexes))
    }))
    
    return res.sendStatus(200);
})
app.post('/api/downloadMusic', async (req, res)=> {
    
})

app.listen(process.env.WEBSITEPORT)

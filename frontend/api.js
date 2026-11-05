let currently_playing = {'index': null, 'audio':null};
const getMusic = async () =>{
    const doc = document
    const fetch_req = await fetch("/api/musiclist")
    const json = await fetch_req.json()
    let CreateMusicListIndex = function(data, relativeDoc = document){
    
        let Music = doc.createElement('div')
        Music.className = 'Music'
        
        let MusicButton = doc.createElement('div')
        MusicButton.className='Button'
        MusicButton.addEventListener('click', ()=>{
            HandleMusic(data['index'])
        })
        let MusicTitle = doc.createElement('div')
        MusicTitle.className='Title'
        MusicTitle.innerText=data['name']


        relativeDoc.append(Music)
        Music.append(MusicButton, MusicTitle)
        
    }
    for(let key of Object.keys(json)){
        CreateMusicListIndex(json[key], doc.getElementsByClassName('MusicList')[0])
        
    }
}

const HandleMusic=async function(index){
    // 0 !== 1 ( so anything that isnt the same music index )
    if(currently_playing.index !== index){
        if(currently_playing.audio?.paused === false){
            currently_playing.audio.pause()
            currently_playing.audio.currentTime = 0;
            currently_playing.audio.src = "0";
            currently_playing.audio.load();
            currently_playing.audio=null
        }
        currently_playing.index=index
        const blob = await downloadMusic(index)
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        currently_playing.audio=audio

        audio.play()
    }else{
        if(currently_playing.audio?.paused === false)currently_playing.audio.pause()
        else currently_playing.audio.play()
    }
}

const downloadMusic = async (index) =>{
    if(!Number(index)){ return {err: "Bad index"}}
    const fetch_req = await fetch("/api/downloadMusic", {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
        body: JSON.stringify({ index: index })
    })
    const blob = await fetch_req.blob()
    return blob
}
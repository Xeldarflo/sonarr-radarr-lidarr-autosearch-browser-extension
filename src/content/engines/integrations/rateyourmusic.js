(function(){
    if (!window.__servarrEngines) window.__servarrEngines = { list: [], helpers: {} };

    var Def = window.__servarrEngines.helpers.DefaultEngine;

    var Album = Def({
        id: 'rateyourmusic',
        key: 'rateyourmusic-album',
        urlIncludes: ['rateyourmusic.com/release/album'],
        siteType: 'lidarr',
        containerSelector: '.album_title',
        insertWhere: 'prepend',
        iconStyle: 'width: 20px; margin-right: 5px;',
        getSearch: async function(_el,doc){ 
            var artist, album, type, id, lidarrid = "";

            var qa = doc.querySelector('.artist'); 
            artist = (qa && (qa.textContent||'').trim())||''; 

            var qat = doc.querySelector('.album_title'); 
            album = (qat && (qat.textContent||'').split("  ")[0].trim())||''; 

            var qi = doc.querySelectorAll(".info_hdr");
            if(qi && qi.length >= 1){
                type = qi[1].nextElementSibling.innerText;
            }

            if(artist && album && type){
                id = await getReleaseGroupMBID(artist, album, type);
            }

            if(id){
                lidarrid = `lidarr:${id}`;
                lidarrid = lidarrid.trim();
                return lidarrid;
            }

            return `${album} ${artist}`; 
        }
    });

    var Artist = Def({
        id: 'rateyourmusic',
        key: 'rateyourmusic-artist',
        urlIncludes: ['rateyourmusic.com/artist'],
        siteType: 'lidarr',
        containerSelector: '.artist_name_hdr',
        insertWhere: 'prepend',
        iconStyle: 'width: 20px; margin-right: 5px;',
        getSearch: async function(_el,doc){ 
            var artist, id, lidarrid = "";

            var qa=doc.querySelector('.artist_name_hdr');
            artist = (qa && (qa.textContent||'').trim())||'';
            if(artist){
                id = await getArtistMBID(artist);
            }

            if (id) {
                lidarrid = `lidarr:${id}`;
                lidarrid = lidarrid.trim();
                return lidarrid;
            }

            return artist;
        }
    });

    window.__servarrEngines.list.push(Album, Artist);
})();

// Local, north-up Landsat RGB image. Display extent is EPSG:3857.
export const satellite={
 path:'assets/maps/ansan-satellite-2026-10-06.jpg',date:'2026-10-06',
 bbox:[126.55,37.21,126.91,37.39],width:1600,height:1006,
 source:'https://planetarycomputer.microsoft.com/api/stac/v1/collections/landsat-c2-l2/items/LC08_L2SP_116034_20261006_02_T1',
 credit:'USGS Landsat 8 · Microsoft Planetary Computer',
 // Representative place markers, not individual photo camera positions.
 places:[{id:'lake',lon:126.612,lat:37.312},{id:'wetland',lon:126.838,lat:37.271},{id:'river',lon:126.835,lat:37.316}]
};
export function mapPoint(lon,lat){
 const [w,s,e,n]=satellite.bbox;
 const y=v=>Math.log(Math.tan(Math.PI/4+v*Math.PI/360));
 return {x:100*(lon-w)/(e-w),y:100*(y(n)-y(lat))/(y(n)-y(s))};
}
export function initSatellite(){
 const panel=document.querySelector('.map-panel');
 panel.classList.add('satellite-panel');
 panel.innerHTML=`<div class="satellite-viewport"><img class="map-art" src="${satellite.path}" alt="" width="1600" height="1006"><div class="satellite-shade"></div><div class="satellite-heading"><span>ANSAN / SATELLITE ATLAS</span><small>LANDSAT 8 · 30 m / 2026.10.06</small></div><span class="satellite-north" aria-hidden="true">N<br>↑</span>${satellite.places.map((p,i)=>{const q=mapPoint(p.lon,p.lat);return `<button class="map-pin" data-site="${p.id}" style="--x:${q.x}%;--y:${q.y}%"><i>0${i+1}</i><span data-i18n="${p.id}"></span></button>`}).join('')}<span class="satellite-lake-label">SIHWA LAKE</span></div><div class="satellite-footer"><p data-i18n="schematic"></p><a href="${satellite.source}" target="_blank" rel="noopener">USGS Landsat / MPC ↗</a></div>`;
}

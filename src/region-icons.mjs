export const regionImages={"吟唱者草甸": "./images/regions/singers-meadow.webp", "轰鸣虫壳地": "./images/regions/humbler-huskland.webp", "峡谷": "./images/regions/ravines.webp", "咆哮树林": "./images/regions/howling-woods.webp", "深暗之域": "./images/regions/the-deep-dark.webp", "多雨平原": "./images/regions/rainy-plains.webp", "冰封高地": "./images/regions/frozen-highlands.webp", "勇者港湾": "./images/regions/brave-haven.webp", "蜜脾原野": "./images/regions/honeycomb-fields.webp", "安眠丘陵": "./images/regions/lullaby-hills.webp", "余烬峭壁": "./images/regions/cinder-crags.webp"};
export function setRegionText(element,name,text=name){
 if(element.dataset.regionLabel===text&&element.querySelector('.region-icon'))return;
 const fragment=document.createDocumentFragment();
 if(regionImages[name]){const image=document.createElement('img');image.className='region-icon';image.src=regionImages[name];image.alt='';image.width=22;image.height=22;image.addEventListener('error',()=>{image.hidden=true},{once:true});fragment.append(image);}
 const label=document.createElement('span');label.textContent=text;fragment.append(label);element.replaceChildren(fragment);element.dataset.regionLabel=text;
}

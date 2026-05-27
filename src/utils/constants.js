export const ITEM_QUICK_SELECT = ["欄杆", "玻璃欄杆", "立面格柵", "水平格柵", "包板", "門"];
export const CHECK_OPTIONS = ["錯誤", "須修改", "預埋件"];

export const FLOOR_OPTIONS = [];
for(let i=1; i<=20; i++) FLOOR_OPTIONS.push(`${i}F`);
['R1', 'R2', 'R3', 'PRF'].forEach(f => FLOOR_OPTIONS.push(f));

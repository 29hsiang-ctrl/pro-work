export const getROCDate = () => {
    const date = new Date();
    return `${date.getFullYear() - 1911}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
};

export async function applyWatermark(dataUrl, text) {
    if (!text) return dataUrl;
    const img = new Image();
    img.src = dataUrl;
    await new Promise(r => { img.onload = r; img.onerror = r; });
    if (!img.width) return dataUrl;
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const fontSize = Math.max(18, Math.floor(canvas.width * 0.025));
    ctx.font = `bold ${fontSize}px sans-serif`;
    const paddingX = fontSize * 0.4, paddingY = fontSize * 0.2;
    const textWidth = ctx.measureText(text).width;
    const lineHeight = fontSize * 1.2;
    const rectX = Math.floor(canvas.width * 0.02);
    const rectY = Math.floor(canvas.height * 0.02);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillRect(rectX, rectY, textWidth + paddingX * 2, lineHeight + paddingY * 2);
    ctx.fillStyle = '#dc2626';
    ctx.textBaseline = 'top';
    ctx.fillText(text, rectX + paddingX, rectY + paddingY + (lineHeight - fontSize) / 2);
    return canvas.toDataURL('image/jpeg', 0.85);
}

export const compressImage = (file, maxWidth = 800, quality = 0.5) => {
    return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            const canvas = document.createElement('canvas');
            let width = img.width, height = img.height;
            if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; }
            canvas.width = width; canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("圖片處理失敗")); };
        img.src = objectUrl;
    });
};

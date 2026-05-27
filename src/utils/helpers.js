export const getROCDate = () => {
    const date = new Date();
    return `${date.getFullYear() - 1911}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
};

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

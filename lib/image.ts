/** Memperkecil gambar di browser sebelum dikirim, supaya hemat penyimpanan. */
export function resizeImage(file: File, max: number, type: "image/jpeg" | "image/png" = "image/jpeg", quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("Gambar tidak bisa dibaca."));
    fr.onload = () => {
      const im = new Image();
      im.onerror = () => reject(new Error("Gambar tidak bisa dibaca."));
      im.onload = () => {
        const k = Math.min(1, max / Math.max(im.width, im.height));
        const c = document.createElement("canvas");
        c.width = Math.round(im.width * k);
        c.height = Math.round(im.height * k);
        const x = c.getContext("2d")!;
        if (type === "image/jpeg") { x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); }
        x.drawImage(im, 0, 0, c.width, c.height);
        resolve(c.toDataURL(type, quality));
      };
      im.src = String(fr.result);
    };
    fr.readAsDataURL(file);
  });
}

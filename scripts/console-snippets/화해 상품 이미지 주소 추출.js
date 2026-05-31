const imgs = [...document.images].filter((img) => img.alt === "상품 이미지");

console.table(
  imgs.map((img, index) => ({
    no: index + 1,
    src: img.currentSrc || img.src,
    width: img.naturalWidth,
    height: img.naturalHeight,
  })),
);

const n = Number(prompt("복사할 상품 이미지 번호"));
copy(imgs[n - 1]?.currentSrc || imgs[n - 1]?.src);

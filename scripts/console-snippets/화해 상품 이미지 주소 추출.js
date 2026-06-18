const imgs = [...document.images].filter((img) => {
  const alt = img.alt?.trim() || "";
  return alt.includes("상품") || alt.includes("제품");
});

console.table(
  imgs.map((img, index) => ({
    no: index + 1,
    alt: img.alt,
    src: img.currentSrc || img.src,
    width: img.naturalWidth,
    height: img.naturalHeight,
  })),
);

if (imgs.length === 0) {
  console.warn("상품/제품 이미지를 찾지 못했습니다.");
} else {
  const n = Number(prompt(`복사할 상품 이미지 번호 (1~${imgs.length})`, "1"));
  const img = imgs[n - 1];

  if (!img) {
    console.warn("잘못된 번호입니다.", { 입력값: n, 이미지수: imgs.length });
  } else {
    const src = img.currentSrc || img.src;
    copy(src);
    console.log("복사 완료:", src);
  }
}
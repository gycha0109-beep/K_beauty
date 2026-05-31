(() => {
  const scripts = [...document.scripts]
    .map((s, index) => ({
      index,
      text: s.textContent || "",
    }))
    .filter((x) => x.text.includes('"@type":"ItemList"') || x.text.includes('"itemListElement"'));

  const results = [];

  for (const script of scripts) {
    try {
      const json = JSON.parse(script.text);
      const list = Array.isArray(json) ? json : [json];

      for (const item of list) {
        if (item?.["@type"] !== "ItemList") continue;

        const elements = item.itemListElement || [];

        for (const el of elements) {
          const brand = el?.brand?.name || "";
          const productName = el?.name || "";
          const position = el?.position ?? null;
          const url = el?.url || "";
          const price = el?.offers?.price ? Number(el.offers.price) : null;

          if (!brand || !productName) continue;

          results.push({
            rank: position,
            brand,
            productName,
            url,
            price,
          });
        }
      }
    } catch (error) {
      // Ignore non-JSON script blocks on the page.
    }
  }

  const deduped = [
    ...new Map(results.map((x) => [`${x.rank}-${x.brand}-${x.productName}`, x])).values(),
  ].sort((a, b) => (a.rank || 9999) - (b.rank || 9999));

  const jsonText = JSON.stringify(deduped, null, 2);

  console.table(deduped);
  console.log(jsonText);

  document.querySelector("#hwahae-json-result")?.remove();

  const box = document.createElement("textarea");
  box.id = "hwahae-json-result";
  box.value = jsonText;
  box.style.position = "fixed";
  box.style.top = "20px";
  box.style.left = "20px";
  box.style.zIndex = "999999";
  box.style.width = "700px";
  box.style.height = "520px";
  box.style.background = "white";
  box.style.color = "black";
  box.style.border = "2px solid black";
  box.style.fontSize = "12px";
  box.style.padding = "10px";

  document.body.appendChild(box);

  console.log(`완료: ${deduped.length}개 추출됨. 왼쪽 위 박스에서 Ctrl+A -> Ctrl+C`);
})();

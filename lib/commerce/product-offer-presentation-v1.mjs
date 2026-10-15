// D8K-3 presentation only. Accept the D8K-1 comparator output, never raw RPC rows.
export const OFFER_PRESENTATION_VERSION = 'd8k3-offer-presentation-v1';
const LANGUAGE = {
  ko: { title:'구매처 비교', checking:'판매처 확인 중', held:'구매처 정보를 확인하고 있습니다',
    offered:'확인된 옵션별 판매처', single:'단품', multipack:'묶음', kit:'기획세트',
    gift:'증정 구성 포함', price:'선택 옵션 가격', total:'배송비 포함 가격',
    shippingUnknown:'배송비 미확인 · 최종 결제금액 아님', cta:'구매처 링크 확인 중',
    refreshed:'가격 확인', none:'확인된 판매처 가격이 없습니다', noCheapest:'최종 결제 최저가를 보장하지 않습니다' },
  en: { title:'Compare sellers', checking:'Checking sellers', held:'Seller details under review',
    offered:'Observed seller options', single:'Single item', multipack:'Multipack', kit:'Gift set',
    gift:'Includes gift items', price:'Selected-option price', total:'Price including shipping',
    shippingUnknown:'Shipping unverified · not the final checkout amount', cta:'Purchase link under review',
    refreshed:'Price observed', none:'No verified seller prices available', noCheapest:'Final checkout lowest price is not guaranteed' }
};
const isIntegerPrice = n => Number.isSafeInteger(n) && n > 0 && n <= 1e9;
const isShipping = n => Number.isSafeInteger(n) && n >= 0 && n <= 1e9;
const safeText = (v,max=160) => typeof v==='string' && v.length<=max &&
  !/[\u0000-\u001f\u007f]/.test(v) ? v.trim() : '';
function sizeLabel(pack) {
  if (!pack || !Number.isSafeInteger(pack.unitSize) || pack.unitSize<1 ||
      !Number.isSafeInteger(pack.quantity) || pack.quantity<1 ||
      !['ml','g','ea'].includes(pack.sizeUnit)) return '';
  return pack.unitSize+pack.sizeUnit+' × '+pack.quantity;
}
function dateLabel(stamp, locale) {
  if (typeof stamp!=='string' || !/^\d{4}-\d{2}-\d{2}T/.test(stamp)) return '';
  const ms=Date.parse(stamp);
  if(!Number.isFinite(ms)) return '';
  return new Intl.DateTimeFormat(locale==='en'?'en-GB':'ko-KR',{
    timeZone:'Asia/Seoul', year:'numeric',month:'2-digit',day:'2-digit'
  }).format(new Date(ms));
}
export function buildOfferPresentation(comparison,locale='ko') {
  const lang=locale==='en'?'en':'ko', copy=LANGUAGE[lang];
  const base={ version:OFFER_PRESENTATION_VERSION, locale:lang, title:copy.title,
    groups:[], status:'checking', message:copy.checking,
    noCheapest:copy.noCheapest, directCtaEnabled:false };
  if(!comparison||typeof comparison!=='object'||comparison.status==='hold') {
    return { ...base,status:'hold',message:copy.held };
  }
  if(comparison.status!=='options_observed'||!Array.isArray(comparison.groups)) {
    return { ...base,message:copy.none };
  }
  const groups=[];
  for(const group of comparison.groups.slice(0,64)) {
    if(!group||!['single','multipack','kit'].includes(group.optionKind)||
        !Array.isArray(group.offers)) continue;
    const pack=group.packComposition;
    const size=sizeLabel(pack);
    const desc=[copy[group.optionKind],size,Array.isArray(pack?.gifts)&&pack.gifts.length>0?copy.gift:''].filter(Boolean).join(' · ');
    const rows=[];
    // A row's total is not proof of shipping. Match the D8K-1 full-group
    // known-shipping calculation and independently check the arithmetic.
    const completeCheckout=group.sortBasis==='known_total_checkout' &&
      group.offers.length>0 && group.offers.every(row=>
        row && isIntegerPrice(row.observedPrice) && isShipping(row.shippingCost) &&
        isIntegerPrice(row.totalPrice) &&
        row.totalPrice===row.observedPrice+row.shippingCost);
    for(const offer of group.offers.slice(0,256)) {
      // Real authority must be proved before an actual D8K-1 projection is supplied.
      if(!offer||!isIntegerPrice(offer.observedPrice)) continue;
      const total=completeCheckout;
      const shippingUnknown=!isShipping(offer.shippingCost);
      const amount=total?offer.totalPrice:offer.observedPrice;
      rows.push({
        key:safeText(offer.offerId,60), seller:safeText(offer.sellerName,160)||safeText(offer.sellerKey,80),
        amount, amountLabel:copy[total?'total':'price'],
        formattedAmount:new Intl.NumberFormat(lang==='en'?'en-US':'ko-KR').format(amount)+(lang==='en'?' KRW':'원'),
        observedAt:dateLabel(offer.observedAt,lang), observedLabel:copy.refreshed,
        shippingUnknown, shippingMessage:shippingUnknown?copy.shippingUnknown:'',
        // D8K-3 is offline UI only. Never activate purchase links here.
        ctaEnabled:false, ctaLabel:copy.cta, href:null
      });
    }
    if(rows.length) groups.push({key:safeText(group.comparisonGroup,512),description:desc,rows});
  }
  return { ...base,status:groups.length?'available':'checking',
    message:groups.length?copy.offered:copy.none,groups };
}

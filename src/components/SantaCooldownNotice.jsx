import { useEffect, useState } from 'react';

export const SANTA_GIFT_COMPARISONS = [
  'a Crayola light up Santa',
  'a pair of fluffy socks',
  'a Nivea for Men gift set',
  'a tub of Celebrations',
  'a Maltesers gift box',
  'a box of Lindt chocolate truffles',
  'a Card Factory novelty gift mug',
  'some Cadbury Santa socks',
  'three Highland cow pens from NEXT',
  'a Christmas puzzle book from The Works',
  'a tub of HEROES chocolates',
  'a Habitat decorative glass bauble',
];

// Keep the choice for this page visit, including client-side navigation.
// Choose in the effect so server and initial client markup still agree.
let pageGiftIndex;

export default function SantaCooldownNotice() {
  const [giftIndex, setGiftIndex] = useState(0);
  useEffect(() => {
    pageGiftIndex ??= Math.floor(Math.random() * SANTA_GIFT_COMPARISONS.length);
    setGiftIndex(pageGiftIndex);
  }, []);
  return (
    <p className="message-recovery-copy">
      <span role="status">You’ve created a Free Santa message. Please allow Santa 30 mins to recover before he records more.</span>
      {' '}Coming soon! You can personalise your message further for the price of (
      <span aria-live="off" data-testid="santa-gift-comparison">{SANTA_GIFT_COMPARISONS[giftIndex]}</span>).
      {' '}Meanwhile, why not tell friends and enjoy Santa Radio Christmas music while you wait.
    </p>
  );
}

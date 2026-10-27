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

export default function SantaCooldownNotice() {
  const [giftIndex, setGiftIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setGiftIndex(index => (index + 1) % SANTA_GIFT_COMPARISONS.length), 8000);
    return () => clearInterval(timer);
  }, []);
  return (
    <p className="message-recovery-copy">
      <span role="status">You’ve created a Free Santa message. Please allow Santa 30 minutes to recover before he records more.</span>
      {' '}Coming soon, you can personalise your message more for the price of{' '}
      <span aria-live="off" data-testid="santa-gift-comparison">{SANTA_GIFT_COMPARISONS[giftIndex]}</span>.
      {' '}Meanwhile, why not tell your friends and then enjoy Santa Radio Christmas music while you wait.
    </p>
  );
}

export const BESPOKE_MESSAGES_PATH = '/bespoke-santa-messages';

export const kidsOffer = {
  id: 'kids-santa-message',
  title: 'Kids’ Message from Santa',
  description: 'Create a personalised Christmas video for your child, with their name, achievements, a letter from Santa and a Nice List certificate. £6.50 includes two creations.',
  image: '/images/message-maker-kids-share.jpg',
};
export const dadOffer = {
  id: 'dad-santa-message',
  title: 'Dad’s Message from Santa',
  description: 'Give Dad a laugh with a £5 personalised Christmas video from Santa, featuring his name, favourite TV and questionable habits. Includes a certificate for Dad.',
  image: '/images/message-maker-dad-share.jpg',
};
export const freeOffer = {
  id: 'free-santa-message',
  title: 'Free Message from Santa',
  description: 'Create a free personalised Christmas video from Santa with your child’s name. Discover even more Christmas magic at Santa Radio.',
  image: '/images/message-maker-free-share.jpg',
};

export const messageMakerOffers = [
  freeOffer,
  {
    id: 'bespoke-santa-messages',
    title: 'Personalised Santa Messages for Kids and Dads',
    label: 'Both Message Maker offers',
    description: 'Choose a magical Christmas video for your child or a funny one for Dad. Hear an example and explore both personalised Message Maker offers from Santa Radio.',
    image: '/images/message-maker-both-share.jpg',
  },
  kidsOffer,
  dadOffer,
];
export const messageOfferPath = offer => `/share/${offer.id}`;

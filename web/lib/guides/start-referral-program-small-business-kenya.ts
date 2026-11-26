import type { Guide } from "./types";

export const guide: Guide = {
  slug: "start-referral-program-small-business-kenya",
  title: "How to start a referral program for a small business in Kenya",
  metaTitle: "How to start a referral program in Kenya",
  description:
    "Start a referral program for a small business in Kenya: pick a goal, set a reward in KES you can afford, decide what counts and cap the cost.",
  summary:
    "Set up a refer-a-friend offer with a notebook and WhatsApp: goal, reward in KES, proof, cap and payout.",
  audience: "For any small business owner in Kenya",
  published: "2026-11-26",
  updated: "2026-11-26",
  intro: [
    "To start a referral program for a small business in Kenya, do five things. Pick one goal. Choose a reward in shillings you can afford. Write down what counts as a real referral. Set a limit on what you will spend. Then tell the customers you already have. A notebook and WhatsApp are enough. You do not need a website or software.",
    "A referral program is a clear promise: when a customer brings a friend who buys, you thank them with a reward. Your customers may already tell their neighbours, workmates and family about you. A program gives them a reason to do it more often, and gives you a way to count it.",
  ],
  sections: [
    {
      id: "six-decisions",
      heading: "Make six decisions before you tell anyone",
      blocks: [
        {
          type: "steps",
          items: [
            {
              title: "Pick one goal",
              text: "Choose one thing you can count, for example 20 new customers or 10 cake orders this month.",
            },
            {
              title: "Choose who gets the reward",
              text: "Rewarding only the customer who brings a friend costs least. Rewarding both gives the friend a reason to come now.",
            },
            {
              title: "Choose the reward",
              text: "Airtime, a discount, a free service or a voucher all work. The next section shows how to set the amount.",
            },
            {
              title: "Say what counts as a real referral",
              text: "Write one rule. For example: the friend has never bought from us, pays KES 500 or more, and says who sent them.",
            },
            {
              title: "Set a cap",
              text: "Decide the most you will spend, for example the first 20 referrals. Tell customers the cap, so nobody feels cheated when it ends.",
            },
            {
              title: "Set an end date",
              text: "Four to six weeks is a good first run. A date gives people a reason to act now, and lets you fix what did not work.",
            },
          ],
        },
        {
          type: "note",
          text: "Give the reward to **everyone who qualifies**. Lucky draws and raffles may need a licence from the Gambling Regulatory Authority of Kenya or from your county government, so check before you run one. Clinics, pharmacies and other regulated services should ask their regulator before rewarding referrals.",
        },
      ],
    },
    {
      id: "what-you-can-afford",
      heading: "Work out what you can afford",
      blocks: [
        {
          type: "p",
          text: "Base the reward on the **profit** from a new customer's first sale, not on the price.",
        },
        {
          type: "p",
          text: "Say a first visit to your salon costs KES 1,000, and after products, rent and pay you keep about KES 500. If you give your customer KES 150 airtime and the friend KES 100 off, you spend KES 250 and keep KES 250 on that visit. Every later visit earns you the full KES 500.",
        },
        {
          type: "p",
          text: "A safe start is a quarter to a half of that first profit, shared between your customer and the friend. Go to the higher end if customers usually come back. Then set the cap: KES 250 for each referral, times 20 referrals, is KES 5,000 at most. For what to give, see [referral reward ideas](/guides/referral-reward-ideas-kenya).",
        },
      ],
    },
    {
      id: "example-campaigns",
      heading: "Three example campaigns",
      blocks: [
        {
          type: "example",
          title: "A salon",
          rows: [
            ["Goal", "20 new customers in 6 weeks"],
            ["Reward", "KES 150 airtime for the customer, KES 100 off for the friend"],
            ["Counts when", "The friend is new to us, pays for a service and says who sent them"],
            ["Cap", "First 20 referrals, KES 5,000 in total"],
          ],
        },
        {
          type: "example",
          title: "A bakery",
          rows: [
            ["Goal", "15 new cake orders this month"],
            ["Reward", "A box of 6 cupcakes for the customer who sent them (about KES 250 to make)"],
            ["Counts when", "A new customer orders a cake of KES 2,500 or more, pays the deposit and says who sent them"],
            ["Cap", "First 15 referrals, about KES 3,750 in total"],
          ],
        },
        {
          type: "example",
          title: "A gym",
          rows: [
            ["Goal", "10 new monthly members"],
            ["Reward", "KES 500 off the next month for the member and for the friend"],
            ["Counts when", "The friend pays for a full month, not a day pass, and was not a member in the last 6 months"],
            ["Cap", "First 10 new members, KES 10,000 in total"],
          ],
          note: "These are examples, not results. Change the amounts to fit your own prices and profit.",
        },
      ],
    },
    {
      id: "tell-your-customers",
      heading: "Tell the customers you already have",
      blocks: [
        {
          type: "list",
          items: [
            "**At the counter.** Say it in one sentence as you hand over the change or the receipt.",
            "**WhatsApp Status.** Post the offer once or twice a week while it runs.",
            "**Broadcast list.** Send it to customers who have saved your number and are happy to hear from you.",
            "**A printed card or a sign at the till.** Put the reward and the rule in big letters. You can add a QR code that opens your WhatsApp chat.",
          ],
        },
        {
          type: "template",
          label: "Message to your customers",
          text: "Hi [name], thank you for coming to [business name].\n\nFrom today until [date], bring a friend who has never been to us. When they pay for [service or item], you get [your reward] and they get [their reward].\n\nThey only need to tell us your name. The offer is for the first [number] friends.",
        },
        {
          type: "p",
          text: "For messages your customers can forward to a friend, use the [WhatsApp referral message templates](/guides/whatsapp-referral-message-templates).",
        },
        {
          type: "note",
          text: "Let customers tell their own friends. Do not collect friends' phone numbers and message them yourself: contacting people who did not agree to hear from you can break Kenya's Data Protection Act.",
        },
      ],
    },
    {
      id: "track-referrals",
      heading: "Track it: a notebook or a link for each customer",
      blocks: [
        {
          type: "p",
          text: "You need to know three things: who sent whom, whether the friend paid, and whether you have given the reward.",
        },
        {
          type: "table",
          head: ["", "Notebook", "A link per customer"],
          rows: [
            [
              "How it works",
              "The friend says who sent them. You write it down.",
              "Each customer shares a link. A tool counts who opened it and who joined.",
            ],
            [
              "Good when",
              "You serve every customer yourself.",
              "You have staff, branches or WhatsApp orders.",
            ],
            [
              "Weak point",
              "Names get missed on busy days.",
              "Customers must open a link and sign in.",
            ],
          ],
        },
        {
          type: "p",
          text: "If you are at the till every day, start with a notebook. Give each referral one line: the date, both names, the amount paid and the reward given. Move to a tool such as Ubu-Tangaza when you lose track of names or of rewards you owe.",
        },
      ],
    },
    {
      id: "common-mistakes",
      heading: "Four mistakes to avoid",
      blocks: [
        {
          type: "list",
          items: [
            "**Staff who do not know the offer.** Everyone who serves customers should ask \"Who sent you?\" and write the name down. Tell them the rule before you tell customers.",
            "**Unclear rules.** If customers keep asking \"does this count?\", rewrite the rule until it fits in one sentence.",
            "**Paying before checking.** Give the reward after the friend has paid, and count only people who have never bought from you. That is the simplest guard against fake referrals.",
            "**Slow payout.** Send the airtime or hand over the voucher the same week. A customer who waits a month may not refer again.",
          ],
        },
      ],
    },
    {
      id: "with-ubu-tangaza",
      heading: "Doing this with Ubu-Tangaza",
      blocks: [
        {
          type: "p",
          text: "Ubu-Tangaza does the tracking in a phone browser, with no app to install.",
        },
        {
          type: "list",
          items: [
            "You create a campaign and set the goal, the reward and how many approved referrals earn it. The ready-made \"Bring a new customer\" campaign also counts posts about your shop until you edit that out.",
            "Each customer who joins gets a personal link to share. You see how many clicks and joins the top links have brought.",
            "The customer sends proof with the friend's name. Nothing counts until you approve it.",
            "You give the reward yourself, then tap \"Mark rewarded\" to see what you still owe.",
          ],
        },
        {
          type: "p",
          text: "It does not check purchases or stop at your cap, so close the campaign when you reach it. The first campaign is free. See [pricing](/pricing) or [book a short call](/book).",
        },
      ],
    },
  ],
  faqs: [
    {
      q: "Do I need a website to run a referral program?",
      a: "No. Customers can pass on your WhatsApp number or your location, and the friend only needs to say who sent them.",
    },
    {
      q: "Do I need to register my business first?",
      a: "The steps in this guide need no paperwork: a notebook and WhatsApp are enough. Your usual permits and taxes are a separate matter, so ask your county office or an accountant if you are unsure.",
    },
    {
      q: "What if two customers say they sent the same friend?",
      a: "Ask the friend on the first visit who sent them, and write down one name only. Put it in your rule: the name the friend gives at the first purchase is the one that counts.",
    },
    {
      q: "How long before a referral program works?",
      a: "It depends on how often your customers visit. Someone who comes once a month may hear about the offer only once in that time, so give it four to six weeks before you judge it. If nobody has asked about it by then, raise the reward or tell customers more often.",
    },
  ],
  related: [
    "whatsapp-referral-message-templates",
    "referral-reward-ideas-kenya",
    "promote-new-shop-opening-kenya",
  ],
};

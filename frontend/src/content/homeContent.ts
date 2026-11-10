export interface NavigationLink {
  label: string;
  href: string;
}

export interface NavigationCta {
  label: string;
  action: string;
}

export interface HeroContent {
  eyebrow: string;
  headline: string;
  description: string;
  ctaButton: string;
  bgImage: string;
}

export interface ProductSpecimen {
  id: string;
  name: string;
  latinName: string;
  price: string;
  editionTag: string;
  frontImageUrl: string;
  hoverImageUrl: string;
  description: string;
}

export interface ProductCategory {
  sectionTitle: string;
  sectionDescription: string;
  items: ProductSpecimen[];
}

export interface GiftPackagingItem {
  id: string;
  name: string;
  price: string;
  description: string;
  imageUrl: string;
  tag?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export interface GiftPackagingCategory {
  sectionTitle: string;
  sectionDescription: string;
  items: GiftPackagingItem[];
}

export interface PhotographTab {
  kind: "photograph";
  title: string;
  excerpt: string;
  imageUrl: string;
  handwrittenCaption: string;
  archivalStamp: string;
}

export interface VoiceRecordTab {
  kind: "voice-record";
  title: string;
  durationLabel: string;
  totalDurationLabel: string;
  quoteExcerpt: string;
  quoteAttribution: string;
  audioSrc?: string;
  songTitle?: string;
}

export interface LetterTab {
  kind: "letter";
  title: string;
  greeting: string;
  letterText: string;
  signoff: string;
  signature: string;
}

export interface VideoMemoirTab {
  kind: "video";
  title: string;
  posterUrl: string;
  caption: string;
  durationLabel: string;
  archivalStamp: string;
}

export type VaultMediaTab =
  | PhotographTab
  | VoiceRecordTab
  | LetterTab
  | VideoMemoirTab;

export interface PrivacyPillar {
  id: string;
  title: string;
  detail: string;
}

export interface WorkflowStep {
  step: number;
  title: string;
  description: string;
}

export interface SmartVaultContent {
  sectionTitle: string;
  sectionSubtitle: string;
  mediaTabs: VaultMediaTab[];
  privacyPillars: PrivacyPillar[];
  workflowSteps: WorkflowStep[];
}

export interface ConciergeContent {
  whatsappNumber: string;
  orderGuidance: string[];
}

export interface HomeContent {
  brandName: string;
  brandTagline: string;
  navLinks: NavigationLink[];
  navCta: NavigationCta;
  hero: HeroContent;
  chapters: ProductCategory;
  singleStems: ProductCategory;
  giftPackaging: GiftPackagingCategory;
  smartVault: SmartVaultContent;
  concierge: ConciergeContent;
}

export const homeContent = {
  brandName: "A Chapter",
  brandTagline: "Atelier of Botanical Keepsakes & Smart Memory Vault",
  navLinks: [
    { label: "The Chapters", href: "#chapters" },
    { label: "Single Stems", href: "#single-stems" },
    { label: "Gift Cards", href: "#gift-cards" },
    { label: "Smart QR Vault", href: "#vault" },
  ],
  navCta: { label: "Commission / Chat", action: "#pesan" },
  hero: {
    eyebrow: "A Chapter · Botanical Artware",
    headline:
      "Every flower holds a moment, every life deserves an eternal chapter.",
    description:
      "Karya seni botani asli yang dipreservasi abadi melalui standar laboratorium, dipadukan dengan brankas kenangan digital untuk menyimpan suara, surat, dan rekaman foto selamanya.",
    ctaButton: "Lihat Semua Karya ↓",
    bgImage:
      "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=2400&q=90",
  },
  chapters: {
    sectionTitle: "The Chapters — Framed Botanical Keepsakes",
    sectionDescription:
      "Rangkaian bunga penuh dalam bingkai anti-UV + Smart QR Vault.",
    items: [
      {
        id: "chapter-rose-garden",
        name: "The Rose Garden",
        latinName: "Rosa hybrida",
        price: "Mulai Rp 1.850.000",
        editionTag: "Signature Chapter",
        frontImageUrl:
          "https://images.unsplash.com/photo-1494972308805-463bc619d34e?auto=format&fit=crop&w=1200&q=85",
        hoverImageUrl:
          "https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=1200&q=85",
        description:
          "Mawar pilihan yang disusun dalam bingkai arsip dengan ruang untuk menyimpan kisah di baliknya.",
      },
      {
        id: "chapter-hydrangea-study",
        name: "Hydrangea Study",
        latinName: "Hydrangea macrophylla",
        price: "Mulai Rp 1.650.000",
        editionTag: "Botanical Study",
        frontImageUrl:
          "https://images.unsplash.com/photo-1563241527-3004b7be0ffd?auto=format&fit=crop&w=1200&q=85",
        hoverImageUrl:
          "https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&w=1200&q=85",
        description:
          "Kelopak hydrangea berlapis menghadirkan komposisi lembut yang disimpan untuk waktu panjang.",
      },
      {
        id: "chapter-meadow-notes",
        name: "Meadow Notes",
        latinName: "Limonium sinuatum",
        price: "Mulai Rp 1.450.000",
        editionTag: "Field Notes",
        frontImageUrl:
          "https://images.unsplash.com/photo-1497250681960-ef046c08a56e?auto=format&fit=crop&w=1200&q=85",
        hoverImageUrl:
          "https://images.unsplash.com/photo-1499002238440-d264edd596ec?auto=format&fit=crop&w=1200&q=85",
        description:
          "Bunga-bunga mungil bernuansa padang rumput ditata sebagai catatan botani personal.",
      },
      {
        id: "chapter-garden-letter",
        name: "A Garden Letter",
        latinName: "Rosa hybrida & assorted botanicals",
        price: "Mulai Rp 2.150.000",
        editionTag: "Story Edition",
        frontImageUrl:
          "https://images.unsplash.com/photo-1520763185298-1b434c919102?auto=format&fit=crop&w=1200&q=85",
        hoverImageUrl:
          "https://images.unsplash.com/photo-1508610048659-a06b669e3321?auto=format&fit=crop&w=1200&q=85",
        description:
          "Perpaduan bunga dan dedaunan pilihan yang dibuat sebagai surat botani untuk seseorang.",
      },
    ],
  },
  singleStems: {
    sectionTitle: "Single Stems — Minimalist Botanical Specimens",
    sectionDescription:
      "Satu kuntum keabadian. Dirancang untuk keanggunan meja kerja, sudut baca, atau ungkapan sederhana yang bermakna mendalam.",
    items: [
      {
        id: "solitary-terracotta-rose",
        name: "The Solitary Terracotta Rose",
        latinName: "Rosa hybrida",
        price: "125000",
        editionTag: "Glass Tube · Single Stem",
        frontImageUrl:
          "https://images.unsplash.com/photo-1494972308805-463bc619d34e?auto=format&fit=crop&w=1200&q=85",
        hoverImageUrl:
          "https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=1200&q=85",
        description:
          "Mawar terracotta preservasi dalam tabung kaca pelindung dengan alas linen, sederhana untuk sudut baca atau meja kerja.",
      },
      {
        id: "preserved-white-hydrangea",
        name: "The Preserved White Hydrangea",
        latinName: "Hydrangea macrophylla",
        price: "145000",
        editionTag: "Glass Tube · Single Stem",
        frontImageUrl:
          "https://images.unsplash.com/photo-1563241527-3004b7be0ffd?auto=format&fit=crop&w=1200&q=85",
        hoverImageUrl:
          "https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&w=1200&q=85",
        description:
          "Hydrangea putih dengan gugus kelopak lembut, disajikan dalam tabung kaca dan kemasan linen.",
      },
      {
        id: "lavender-branch",
        name: "The Lavender Branch",
        latinName: "Lavandula angustifolia",
        price: "135000",
        editionTag: "Linen Presentation",
        frontImageUrl:
          "https://images.unsplash.com/photo-1499002238440-d264edd596ec?auto=format&fit=crop&w=1200&q=85",
        hoverImageUrl:
          "https://images.unsplash.com/photo-1497250681960-ef046c08a56e?auto=format&fit=crop&w=1200&q=85",
        description:
          "Ranting lavender preservasi dengan aroma kenangan taman yang tenang, dibungkus pada lembar linen arsip.",
      },
      {
        id: "golden-fern",
        name: "The Golden Fern",
        latinName: "Nephrolepis exaltata",
        price: "185000",
        editionTag: "Linen Presentation",
        frontImageUrl:
          "https://images.unsplash.com/photo-1497250681960-ef046c08a56e?auto=format&fit=crop&w=1200&q=85",
        hoverImageUrl:
          "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1200&q=85",
        description:
          "Satu helaian pakis berkilau dalam presentasi linen, sebagai aksen botani minimalis yang berkesan.",
      },
    ],
  },
  giftPackaging: {
    sectionTitle: "Gift Cards & Archival Packaging",
    sectionDescription:
      "Kemasan standar museum dan kartu kado digital/fisik untuk momen yang tak terlupakan.",
    items: [
      {
        id: "archival-wood-box",
        name: "The Archival Wooden Box",
        price: "Termasuk dalam setiap bingkai",
        description:
          "Setiap bingkai dikirimkan dalam kotak kayu protektif anti-benturan berstandar pengiriman seluruh Indonesia, siap langsung diberikan sebagai kado tanpa perlu dibungkus ulang.",
        imageUrl:
          "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=1200&q=85",
        tag: "Included with every framed keepsake",
      },
      {
        id: "atelier-gift-card",
        name: "The Digital / Physical Gift Card",
        price: "Mulai Rp 250.000",
        description:
          "Bebaskan penerima untuk merancang babak kenangannya sendiri. Tersedia dalam format voucher fisik eksklusif atau kartu digital instan yang dikirim langsung ke WhatsApp penerima.",
        imageUrl:
          "https://images.unsplash.com/photo-1512909006721-3d6018887383?auto=format&fit=crop&w=1200&q=85",
        tag: "Physical letterpress or instant digital",
        ctaLabel: "PILIH KARTU KADO →",
        ctaHref: "/gift-card",
      },
      {
        id: "wax-seal-message-card",
        name: "Wax Seal Message Card",
        price: "Mulai Rp 45.000",
        description:
          "Kartu ucapan personal dalam amplop arsip dengan sentuhan segel lilin.",
        imageUrl:
          "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=85",
      },
    ],
  },
  smartVault: {
    sectionTitle: "Smart QR Vault — Where Living Memories Reside",
    sectionSubtitle:
      "Edukasi cara kerja memori digital yang ditanam pada bingkai.",
    mediaTabs: [
      {
        kind: "photograph",
        title: "Photograph",
        excerpt:
          "Simpan potret yang mengingatkanmu pada hari dan orang yang paling berarti.",
        imageUrl:
          "https://images.unsplash.com/photo-1511988617509-a57c8a288659?auto=format&fit=crop&w=900&q=85",
        handwrittenCaption: "A day to remember forever · June 2026",
        archivalStamp: "12 high-res photographs secured",
      },
      {
        kind: "voice-record",
        title: "Voice Record",
        durationLabel: "00:00",
        totalDurationLabel: "02:11",
        songTitle: "See You Again — Wiz Khalifa ft. Charlie Puth (Acoustic Keepsake)",
        audioSrc: "/see-you-again.mp3",
        quoteExcerpt:
          "“It's been a long day without you, my friend. And I'll tell you all about it when I see you again... Terima kasih telah menjadi bagian terindah dalam hidupku. Sampai kita berjumpa lagi di babak berikutnya.”",
        quoteAttribution: "Pesan Kenangan & Lagu Perpisahan · A Chapter Vault",
      },
      {
        kind: "letter",
        title: "The Letter",
        greeting: "Untuk Sahabat & Belahan Jiwa yang Terkasih,",
        letterText:
          "Waktu mungkin membawa kita ke persimpangan jalan yang berbeda, namun kenangan yang telah kita ukir bersama takkan pernah lekang oleh jarak dan masa. Sebagaimana kelopak bunga ini yang diawetkan abadi di laboratorium A Chapter, rasa sayang, syukur, dan doa tulusku akan selalu menyertai setiap langkahmu. Ini bukan akhir, melainkan sebuah babak baru. Until we meet again, simpanlah memori ini selamanya.",
        signoff: "Dengan cinta dan rasa hormat terdalam,",
        signature: "Selalu Sahabat Terbaikmu",
      },
      {
        kind: "video",
        title: "Video Memoir",
        posterUrl:
          "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=900&q=85",
        caption: "Kenangan bergerak yang tak pernah pudar · Juni 2026",
        durationLabel: "00:18",
        archivalStamp: "HD memoir film secured",
      },
    ],
    privacyPillars: [
      {
        id: "private-token",
        title: "Enkripsi URL Privat Acak",
        detail:
          "Token URL acak unik 128-bit yang tidak diindeks oleh mesin pencari Google (No-Index header).",
      },
      {
        id: "optional-pin",
        title: "Proteksi PIN 4-Digit",
        detail:
          "Pengirim dapat menyetel kode akses opsional untuk mengunci rekaman suara dan surat yang sangat intim.",
      },
      {
        id: "lifetime-hosting",
        title: "Tanpa Biaya Berlangganan",
        detail:
          "Seluruh foto dan audio disimpan permanen seumur hidup di infrastruktur cloud enterprise tanpa langganan.",
      },
      {
        id: "camera-scan",
        title: "Kamera Bawaan Ponsel",
        detail:
          "Langsung dipindai menggunakan aplikasi kamera iPhone maupun Android tanpa unduh aplikasi pihak ketiga.",
      },
    ],
    workflowSteps: [
      {
        step: 1,
        title: "Unggah Memoar via WhatsApp",
        description:
          "Setelah pemesanan disepakati, Anda menerima link formulir privat untuk mengirim foto, rekaman suara, video, dan teks surat langsung dari HP.",
      },
      {
        step: 2,
        title: "Penanaman Micro-Chip Permanen",
        description:
          "Atelier kami mencetak micro-QR tahan air dan menanamkannya secara presisi pada dudukan kristal resin karya botani pilihan Anda.",
      },
      {
        step: 3,
        title: "Kamera HP & Kenangan Terbuka",
        description:
          "Penerima kado mendekatkan kamera ponsel ke chip fisik, dan brankas kenangan digital seketika terbuka di browser mereka.",
      },
    ],
  },
  concierge: {
    whatsappNumber: "085235242425",
    orderGuidance: [
      "Pilih karya dan hubungi atelier melalui WhatsApp untuk memulai pre-order.",
      "Sampaikan nama produk, jumlah, alamat tujuan, serta tanggal yang diharapkan.",
      "Kirim materi kenangan untuk Smart QR Vault bila ingin menyertakannya.",
      "Atelier akan mengonfirmasi ketersediaan, estimasi pengerjaan, dan rincian pembayaran sebelum pesanan diproses.",
    ],
  },
} satisfies HomeContent;

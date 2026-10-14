import { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  Timestamp,
  setDoc,
  getDoc,
  getDocs,
  deleteField
} from 'firebase/firestore';
import { 
  auth, 
  db, 
  signIn, 
  logOut 
} from './firebase';
import { 
  Recipe, 
  Household, 
  Category,
  QuizQuestion,
  QuizResult
} from './types';
import { 
  extractRecipeFromUrl,
  generateRecipe,
  generateRecipeImage
} from './services/geminiService';
import { 
  Plus, 
  Search, 
  Link as LinkIcon, 
  LogOut, 
  Users, 
  Star, 
  ChevronRight, 
  Flame, 
  X, 
  Loader2,
  Trash2,
  Edit2,
  Clock,
  BookOpen,
  AlertCircle,
  Brain,
  Sparkles,
  Sun,
  Moon,
  CheckCircle2,
  HelpCircle,
  Trophy,
  ArrowRight,
  RotateCcw,
  Award,
  Zap,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-stone-50 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <h1 className="text-2xl font-serif font-bold text-stone-900">Terjadi Kendala</h1>
          <p className="text-stone-500">Terjadi kesalahan tak terduga. Silakan muat ulang halaman aplikasi.</p>
          <Button onClick={() => window.location.reload()}>Refresh App</Button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- UI Components ---

const Button = ({ className, variant = 'primary', ...props }: any) => {
  const variants = {
    primary: 'bg-stone-800 dark:bg-stone-100 text-stone-50 dark:text-stone-900 hover:bg-stone-700 dark:hover:bg-stone-200',
    secondary: 'bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700',
    outline: 'border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-900',
    ghost: 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800',
    danger: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40',
    accent: 'bg-amber-500 hover:bg-amber-600 text-white shadow-md'
  };
  return (
    <button 
      className={cn(
        'px-4 py-2 rounded-full font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
        variants[variant as keyof typeof variants],
        className
      )} 
      {...props} 
    />
  );
};

const Card = ({ children, className }: any) => (
  <div className={cn('bg-white dark:bg-stone-900 rounded-3xl p-6 shadow-sm border border-stone-100 dark:border-stone-800', className)}>
    {children}
  </div>
);

const Modal = ({ isOpen, onClose, title, children }: any) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const mainContent = document.getElementById('main-content');
      if (mainContent) mainContent.setAttribute('aria-hidden', 'true');
      modalRef.current?.focus();
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onCloseRef.current();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = 'unset';
        if (mainContent) mainContent.removeAttribute('aria-hidden');
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 dark:bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <motion.div 
        ref={modalRef}
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-stone-50 dark:bg-stone-900 rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl outline-none"
      >
        <div className="p-6 border-b border-stone-200 dark:border-stone-800 flex justify-between items-center bg-white dark:bg-stone-900">
          <h2 className="text-2xl font-serif font-semibold text-stone-800 dark:text-stone-100">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors" aria-label="Close modal">
            <X className="w-6 h-6 text-stone-400" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 text-stone-600 dark:text-stone-300">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

// --- Helper Functions for Quizzes & Fallbacks ---

function getMaterialQuiz(material: Recipe): QuizQuestion[] {
  if (material.quiz && material.quiz.length > 0) {
    return material.quiz;
  }
  
  // Intelligent auto-generation if quiz was not saved explicitly
  const p1 = material.ingredients[0] || material.title;
  const p2 = material.ingredients[1] || "Menganalisis prinsip dan konsep fundamental";
  const p3 = material.instructions[0] || "Mengidentifikasi pola dan premis dasar materi";

  return [
    {
      question: `Berdasarkan konsep utama "${material.title}", manakah prinsip paling esensial berikut?`,
      options: [
        p1,
        "Mengabaikan fakta empiris dan mengandalkan asumsi subjektif semata",
        "Menghindari penalaran sistematis demi spekulasi bebas",
        "Menghafal tanpa memahami hubungan sebab-akibat materi"
      ],
      correctIndex: 0,
      explanation: `Prinsip utama yang dibahas secara spesifik adalah: "${p1}".`
    },
    {
      question: `Apa tujuan analitis utama dari pembahasan materi "${material.title}"?`,
      options: [
        `Memahami intisari bidang ${material.category} dan melatih pemikiran kritis`,
        "Menghilangkan proses eksperimen dan pengujian ilmiah",
        "Mempersempit sudut pandang logika ke satu teori tunggal",
        "Menolak verifikasi data dalam proses pembelajaran"
      ],
      correctIndex: 0,
      explanation: "Materi ini bertujuan membangun landasan berpikir kritis dan pemahaman menyeluruh atas topik terkait."
    },
    {
      question: `Dalam penerapan langkah pembelajaran materi ini, tahap penting yang ditekankan adalah...`,
      options: [
        p3,
        "Menolak melakukan latihan mandiri dan diskusi kritis",
        "Mengasumsikan hasil akhir tanpa pengujian hipotesis",
        "Melewatkan pemahaman terminologi kunci"
      ],
      correctIndex: 0,
      explanation: `Langkah utama berfokus pada: "${p3}".`
    }
  ];
}

function getIqTier(iq: number): { level: number; label: string; color: string; desc: string } {
  if (iq >= 135) {
    return { level: 5, label: "Level 5 — Master 🔥", color: "text-amber-500", desc: "Level tertinggi (Top Tier)! Terus pertahankan konsistensi belajarmu di performa puncak." };
  } else if (iq >= 125) {
    return { level: 4, label: "Level 4 — Expert", color: "text-purple-500", desc: "Tingkat penguasaan materi tinggi dengan akumulasi perolehan EXP yang konsisten." };
  } else if (iq >= 115) {
    return { level: 3, label: "Level 3 — Advanced", color: "text-blue-500", desc: "Progres belajar pesat dengan kemampuan menyelesaikan kuis berbobot di atas rata-rata." };
  } else if (iq >= 105) {
    return { level: 2, label: "Level 2 — Intermediate", color: "text-emerald-500", desc: "Pemahaman konsep terstruktur dan aktif menyelesaikan berbagai kuis evaluasi." };
  } else {
    return { level: 1, label: "Level 1 — Novice (Pemula)", color: "text-stone-500", desc: "Fase eksplorasi awal. Setiap kuis yang kamu selesaikan akan menaikkan skor EXP dan Level kamu!" };
  }
}

// --- 6 Stock Learning Materials with Complete Quizzes ---

const STOCK_RECIPES: Partial<Recipe>[] = [
  {
    title: "Dasar Algoritma & Berpikir Komputasional",
    category: "Teknologi",
    rating: 5,
    estimatedTime: 15,
    ingredients: [
      "Dekomposisi: Memecah masalah kompleks menjadi sub-masalah kecil yang mandiri.",
      "Pengenalan Pola: Mengidentifikasi kesamaan karakteristik dan tren data.",
      "Abstraksi: Memilah informasi esensial dan mengabaikan detail yang tidak relevan.",
      "Perancangan Algoritma: Menyusun langkah-langkah logis berurutan untuk menyelesaikan persoalan.",
      "Analisis Kompleksitas Big-O: Mengukur efisiensi eksekusi terhadap skala input data."
    ],
    instructions: [
      "Pahami pilar Dekomposisi dengan memecah alur otentikasi menjadi validasi kredensial, verifikasi hash, dan penerbitan sesi.",
      "Gunakan Pengenalan Pola untuk mendeteksi repetisi proses dan menerapkan struktur algoritma yang sudah terbukti optimal.",
      "Terapkan Abstraksi untuk mendefinisikan antarmuka (interface) data tanpa membebani memori dengan detail implementasi perangkat keras.",
      "Susun pseudocode algoritma pencarian biner (Binary Search) yang membagi ruang pencarian menjadi setengah pada tiap iterasi logaritmik.",
      "Evaluasi kompleksitas waktu Big-O: bandingkan pencarian linear O(n) dengan pencarian biner O(log n) pada himpunan data besar."
    ],
    imageUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&q=80&w=1000",
    isStock: true,
    quiz: [
      {
        question: "Teknik memecah masalah besar menjadi bagian-bagian lebih kecil yang mudah dikelola disebut...",
        options: ["Dekomposisi", "Abstraksi", "Kompilasi", "Enkripsi"],
        correctIndex: 0,
        explanation: "Dekomposisi adalah proses memecah masalah kompleks menjadi komponen-komponen yang lebih kecil dan terkelola."
      },
      {
        question: "Berapa kompleksitas waktu pencarian Binary Search pada array yang telah terurut?",
        options: ["O(1)", "O(n)", "O(log n)", "O(n^2)"],
        correctIndex: 2,
        explanation: "Binary Search membagi ruang pencarian menjadi dua pada setiap langkah, menghasilkan performa efisien O(log n)."
      },
      {
        question: "Mengabaikan detail kecil yang tidak penting agar dapat fokus pada ide utama dikenal dengan istilah...",
        options: ["Rekursi", "Abstraksi", "Iterasi", "Polimorfisme"],
        correctIndex: 1,
        explanation: "Abstraksi menyaring detail yang tidak relevan agar kita dapat fokus pada konsep inti permasalahan."
      }
    ]
  },
  {
    title: "Mekanika Kuantum: Misteri Dualitas Partikel-Gelombang",
    category: "Sains",
    rating: 5,
    estimatedTime: 20,
    ingredients: [
      "Dualitas Gelombang-Partikel: Foton dan elektron menunjukkan karakteristik partikel sekaligus gelombang.",
      "Prinsip Ketidakpastian Heisenberg: Posisi dan momentum partikel tidak dapat diukur presisi bersamaan.",
      "Superposisi Kuantum: Partikel dapat berada di berbagai probabilitas keadaan hingga diamati.",
      "Eksperimen Celah Ganda: Membuktikan pola interferensi gelombang materi bahkan pada partikel tunggal.",
      "Kuantisasi Energi: Energi diserap dan dipancarkan dalam paket diskrit foton (E = hf)."
    ],
    instructions: [
      "Pelajari eksperimen celah ganda (Double Slit Experiment) yang membuktikan pola interferensi partikel elektron.",
      "Pahami bagaimana tindakan pengamatan fisik meruntuhkan fungsi gelombang (wave function collapse) ke satu keadaan pasti.",
      "Kaitkan hipotesis de Broglie (lambda = h/p) yang menyatakan setiap objek bermassa memiliki panjang gelombang terkait.",
      "Terapkan relasi ketidakpastian Heisenberg delta(x) * delta(p) >= h / 4pi dalam memahami orbital probabilitas elektron.",
      "Eksplorasi implikasi superposisi kuantum dalam komputasi kuantum modern berbasis Qubit."
    ],
    imageUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=1000",
    isStock: true,
    quiz: [
      {
        question: "Siapa ilmuwan yang merumuskan bahwa partikel materi juga memiliki sifat gelombang (lambda = h/p)?",
        options: ["Louis de Broglie", "Isaac Newton", "Albert Einstein", "Niels Bohr"],
        correctIndex: 0,
        explanation: "Louis de Broglie mengusulkan hipotesis dualitas gelombang-materi pada tahun 1924."
      },
      {
        question: "Menurut Prinsip Ketidakpastian Heisenberg, dua besaran apa yang tidak dapat diukur simultan secara mutlak?",
        options: ["Massa dan Kecepatan", "Posisi dan Momentum", "Energi dan Suhu", "Muatan dan Waktu"],
        correctIndex: 1,
        explanation: "Prinsip Heisenberg menyatakan bahwa ketelitian posisi membatasi kepastian momentum partikel."
      },
      {
        question: "Peristiwa apa yang terjadi pada fungsi gelombang saat suatu sistem kuantum diukur oleh pengamat?",
        options: ["Wave function collapse", "Eksplorasi gravitasi", "Pembalikan spin", "Penghancuran massa"],
        correctIndex: 0,
        explanation: "Pengukuran menyebabkan fungsi gelombang 'kolaps' menjadi satu nilai riil teramati."
      }
    ]
  },
  {
    title: "Kalkulus Diferensial: Seni Menganalisis Laju Perubahan",
    category: "Matematika",
    rating: 5,
    estimatedTime: 25,
    ingredients: [
      "Konsep Turunan: Limit laju perubahan sesaat dy/dx = lim(h->0) [f(x+h) - f(x)] / h.",
      "Aturan Rantai (Chain Rule): Diferensiasi fungsi komposisi d/dx [f(g(x))] = f'(g(x)) * g'(x).",
      "Titik Kritis & Optimasi: Nilai stasioner tercapai saat turunan pertama f'(x) = 0.",
      "Uji Turunan Kedua: f''(x) > 0 menunjukkan kurva cekung ke atas (minimum lokal).",
      "Aplikasi Dinamis: Menghitung laju pertumbuhan, percepatan fisika, dan efisiensi marjinal."
    ],
    instructions: [
      "Visualisasikan turunan pertama sebagai gradien garis singgung pada kurva fungsi di suatu titik koordinat.",
      "Kuasai aturan perpangkatan turunan aljabar: d/dx (x^n) = n * x^(n-1) untuk semua eksponen bilangan riil.",
      "Gunakan Aturan Rantai untuk mendiferensiasikan fungsi komposisi bersarang tanpa harus mengekspansi persamaan.",
      "Tentukan titik-titik stasioner suatu fungsi dengan memecahkan persamaan f'(x) = 0.",
      "Klasifikasikan titik stasioner sebagai nilai maksimum, minimum, atau titik belok menggunakan uji turunan kedua f''(x)."
    ],
    imageUrl: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80&w=1000",
    isStock: true,
    quiz: [
      {
        question: "Berapakah turunan pertama dari fungsi f(x) = 5x^3 - 4x + 7?",
        options: ["15x^2 - 4", "15x^3 - 4x", "5x^2 - 4", "15x^2 + 7"],
        correctIndex: 0,
        explanation: "d/dx(5x^3) = 15x^2, d/dx(-4x) = -4, dan d/dx(7) = 0."
      },
      {
        question: "Jika f'(c) = 0 dan f''(c) < 0, maka pada titik x = c kurva fungsi memiliki...",
        options: ["Maksimum lokal", "Minimum lokal", "Titik belok", "Asimtot datar"],
        correctIndex: 0,
        explanation: "Turunan kedua negatif berarti kurva cekung ke bawah, menandakan puncak maksimum lokal."
      },
      {
        question: "Metode diferensiasi apa yang digunakan untuk menurunkan fungsi bersarang f(g(x))?",
        options: ["Aturan Rantai (Chain Rule)", "Aturan Penjumlahan", "Teorema Pythagoras", "Integrasi Parsial"],
        correctIndex: 0,
        explanation: "Aturan Rantai adalah rumus fundamental untuk mencari turunan dari fungsi komposisi."
      }
    ]
  },
  {
    title: "Psikologi Kognitif: Cara Otak Menyimpan Memori",
    category: "Logika",
    rating: 5,
    estimatedTime: 15,
    ingredients: [
      "Sensory Memory: Memori sensorik cepat yang mempertahankan stimulus indera di bawah 1 detik.",
      "Working Memory: Memori kerja aktif dengan kapasitas rata-rata 7 ± 2 unit informasi (Miller's Law).",
      "Long-Term Memory: Penyimpanan memori jangka panjang yang terbagi menjadi deklaratif dan prosedural.",
      "Chunking: Strategi mengelompokkan fragmen data menjadi unit bermakna untuk mendongkrak retensi.",
      "Spaced Repetition & Active Recall: Metode belajar ilmiah melawan kurva lupa Hermann Ebbinghaus."
    ],
    instructions: [
      "Pelajari model memori Atkinson-Shiffrin: transisi dari memori sensorik ke memori jangka pendek dan panjang.",
      "Pahami peran vital Hipokampus dalam proses konsolidasi jejak memori saraf dari memori kerja ke korteks otak.",
      "Terapkan teknik Chunking saat mengingat informasi kompleks seperti bahasa pemrograman atau angka numerik.",
      "Manfaatkan kurva lupa Ebbinghaus untuk menjadwalkan interval pengulangan berjarak (Spaced Repetition).",
      "Gunakan metode Active Recall (menguji ingatan mandiri) alih-alih membaca pasif untuk memperkuat sinapsis otak."
    ],
    imageUrl: "https://images.unsplash.com/photo-1559757175-5700dde675bc?auto=format&fit=crop&q=80&w=1000",
    isStock: true,
    quiz: [
      {
        question: "Berapa kapasitas rata-rata memori kerja (working memory) menurut Hukum Miller?",
        options: ["7 ± 2 unit informasi", "3 ± 1 unit informasi", "15 ± 3 unit informasi", "Kapasitas tanpa batas"],
        correctIndex: 0,
        explanation: "George Miller mengemukakan bahwa memori kerja manusia secara umum dapat memuat 5 hingga 9 unit data."
      },
      {
        question: "Teknik belajar dengan menguji diri sendiri secara aktif tanpa membuka catatan disebut...",
        options: ["Active Recall", "Passive Reading", "Cramming Semalam", "Subvocalization"],
        correctIndex: 0,
        explanation: "Active Recall merangsang memori saraf untuk menarik kembali informasi yang tersimpan."
      },
      {
        question: "Struktur otak yang berperan paling sentral dalam konsolidasi memori jangka panjang adalah...",
        options: ["Hipokampus", "Medula Oblongata", "Serebelum", "Batang Otak"],
        correctIndex: 0,
        explanation: "Hipokampus bertindak sebagai pusat pemrosesan transfer memori jangka pendek ke jangka panjang."
      }
    ]
  },
  {
    title: "Struktur Bahasa & Retorika Berpikir Kritis",
    category: "Bahasa",
    rating: 5,
    estimatedTime: 12,
    ingredients: [
      "Tiga Pilar Retorika Aristoteles: Logos (daya nalar), Pathos (daya emosi), Ethos (kredibilitas).",
      "Fallacy Ad Hominem: Sesat pikir yang menyerang pribadi lawan alih-alih menguji substansi argumen.",
      "Silogisme Deduktif: Penarikan kesimpulan mutlak dari premis mayor dan minor yang valid.",
      "Straw Man Fallacy: Memelintir argumen lawan menjadi versi karikatur lemah lalu menyerangnya.",
      "Sintaksis & Semantik: Analisis struktur pembentuk kalimat dan konstruksi makna pesan."
    ],
    instructions: [
      "Identifikasi komposisi retorika Aristoteles dalam narasi tulisan untuk memastikan argumen bersandar pada Logos yang solid.",
      "Susun silogisme formal: Premis Mayor (Semua logam menghantarkan panas), Premis Minor (Besi adalah logam), Kesimpulan (Besi menghantarkan panas).",
      "Waspadai bias konfirmasi (confirmation bias) yang kerap menyaring data hanya demi mendukung praduga pribadi.",
      "Kenali fallacy post hoc ergo propter hoc yang keliru menganggap peristiwa yang mendahului otomatis menjadi penyebab.",
      "Dekonstruksi argumen lawan debat dengan memeriksa keabsahan premis dasar sebelum menarik simpulan."
    ],
    imageUrl: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=1000",
    isStock: true,
    quiz: [
      {
        question: "Pilar retorika Aristoteles yang berfokus pada daya tarik logika dan argumentasi rasional adalah...",
        options: ["Logos", "Pathos", "Ethos", "Kairos"],
        correctIndex: 0,
        explanation: "Logos mengacu pada kekuatan penalaran logis, bukti ilmiah, dan kejelasan fakta."
      },
      {
        question: "Menyerang latar belakang atau karakteristik lawan debat alih-alih menyanggah argumennya disebut...",
        options: ["Ad Hominem", "Straw Man", "Slippery Slope", "False Dilemma"],
        correctIndex: 0,
        explanation: "Ad Hominem adalah kesesatan logika di mana seseorang mendiskreditkan karakter pribadi lawannya."
      },
      {
        question: "Penalaran deduktif yang terdiri dari Premis Mayor, Premis Minor, dan Kesimpulan disebut...",
        options: ["Silogisme", "Metafora", "Asonansi", "Paradoks"],
        correctIndex: 0,
        explanation: "Silogisme adalah format penarikan simpulan deduktif formal."
      }
    ]
  },
  {
    title: "Revolusi Industri: Evolusi Teknologi Peradaban",
    category: "Sejarah",
    rating: 5,
    estimatedTime: 18,
    ingredients: [
      "Industri 1.0 (Abad ke-18): Pemanfaatan tenaga uap dan mekanisasi pabrik tekstil Inggris.",
      "Industri 2.0 (Abad ke-19): Elektrifikasi massal, moving assembly line, dan produksi baja skala besar.",
      "Industri 3.0 (Abad ke-20): Otomasi komputasi digital, semikonduktor, dan internet global.",
      "Industri 4.0 (Era Kontemporer): Integrasi sistem siber-fisik, Kecerdasan Buatan (AI), IoT, dan Cloud.",
      "Transformasi Sosial: Pergeseran demografi agraris menuju urbanisasi dan evolusi sistem pendidikan modern."
    ],
    instructions: [
      "Pelajari bagaimana penyempurnaan mesin uap oleh James Watt mentransformasi rantai distribusi kereta api dan manufaktur.",
      "Bandingkan dampak lini perakitan bergerak (assembly line) Henry Ford terhadap penurunan biaya produksi massal.",
      "Pahami revolusi silikon di Lembah Silikon yang melahirkan era mikroprosesor dan komputer personal.",
      "Analisis konvergensi kecerdasan buatan dan komputasi awan yang menjadi lokomotif utama Revolusi Industri 4.0.",
      "Refleksikan bagaimana keterampilan berpikir kritis menjadi kompetensi paling bernilai di era otomasi cerdas."
    ],
    imageUrl: "https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&q=80&w=1000",
    isStock: true,
    quiz: [
      {
        question: "Teknologi apa yang menjadi pemicu revolusioner utama gelombang Revolusi Industri 1.0?",
        options: ["Mesin Uap", "Listrik AC", "Komputer Mikro", "Lini Perakitan Mobil"],
        correctIndex: 0,
        explanation: "Mesin uap James Watt mengawali mekanisasi tenaga mekanik menggantikan tenaga hewan dan manual."
      },
      {
        question: "Tokoh yang memelopori sistem lini perakitan bergerak (moving assembly line) pada Industri 2.0 adalah...",
        options: ["Henry Ford", "Thomas Edison", "Nikola Tesla", "Alexander Graham Bell"],
        correctIndex: 0,
        explanation: "Henry Ford merevolusi manufaktur mobil Model T dengan sistem assembly line pada tahun 1913."
      },
      {
        question: "Karakteristik pembeda paling mendasar dari Revolusi Industri 4.0 adalah integrasi...",
        options: ["Sistem siber-fisik & Kecerdasan Buatan (AI)", "Tenaga kincir air", "Mesin cetak mekanis", "Lokomotif uap"],
        correctIndex: 0,
        explanation: "Industri 4.0 dicirikan oleh perpaduan teknologi siber, AI, IoT, dan otomasi otonom."
      }
    ]
  }
];

// --- Main App Component ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [householdsLoading, setHouseholdsLoading] = useState(true);
  const [households, setHouseholds] = useState<Household[]>([]);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const [selectedHousehold, setSelectedHousehold] = useState<Household | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isHouseholdModalOpen, setIsHouseholdModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null);

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleteHouseholdConfirmOpen, setIsDeleteHouseholdConfirmOpen] = useState(false);

  const [importUrl, setImportUrl] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [aiCategory, setAiCategory] = useState<string>('Teknologi');
  const [aiDetails, setAiDetails] = useState('');

  const [isFirstFamilyModalOpen, setIsFirstFamilyModalOpen] = useState(false);
  const [recipeFormError, setRecipeFormError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // --- IQ & Learning State ---
  const [quizHistory, setQuizHistory] = useState<Record<string, QuizResult>>({});
  const [userIq, setUserIq] = useState<number>(100);

  // Active Quiz State in View Modal
  const [isQuizMode, setIsQuizMode] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number | null>(null);
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const [isQuizCompleted, setIsQuizCompleted] = useState(false);
  const [recentIqGained, setRecentIqGained] = useState(0);

  // Load User IQ and History from localStorage
  useEffect(() => {
    if (!user) return;
    try {
      const storageKey = `let_me_cook_iq_${user.uid}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setQuizHistory(parsed.history || {});
        setUserIq(parsed.iq || 100);
      } else {
        setQuizHistory({});
        setUserIq(100);
      }
    } catch (e) {
      console.error("Error reading IQ storage:", e);
    }
  }, [user]);

  // Save IQ and Quiz history
  const recordQuizCompletion = (material: Recipe, score: number, totalQuestions: number) => {
    if (!user) return;
    const materialKey = material.id || material.title;
    const percentage = Math.round((score / totalQuestions) * 100);

    // Calculate IQ points for this quiz:
    // 100% -> 4 IQ pts, >=66% -> 3 IQ pts, >=33% -> 2 IQ pts, otherwise 1 IQ pt
    let iqPointsEarned = 1;
    if (percentage === 100) iqPointsEarned = 4;
    else if (percentage >= 66) iqPointsEarned = 3;
    else if (percentage >= 33) iqPointsEarned = 2;

    const existingResult = quizHistory[materialKey];
    let netIqIncrease = iqPointsEarned;

    // If retaking, only add incremental IQ difference if improved
    if (existingResult) {
      if (iqPointsEarned > existingResult.iqGained) {
        netIqIncrease = iqPointsEarned - existingResult.iqGained;
      } else {
        netIqIncrease = 0;
      }
    }

    const newResult: QuizResult = {
      materialId: materialKey,
      materialTitle: material.title,
      score,
      totalQuestions,
      percentage,
      iqGained: Math.max(existingResult ? existingResult.iqGained : 0, iqPointsEarned),
      completedAt: Date.now()
    };

    const updatedHistory = { ...quizHistory, [materialKey]: newResult };
    const newIq = userIq + netIqIncrease;

    setRecentIqGained(netIqIncrease);
    setQuizHistory(updatedHistory);
    setUserIq(newIq);

    try {
      localStorage.setItem(`let_me_cook_iq_${user.uid}`, JSON.stringify({
        iq: newIq,
        history: updatedHistory
      }));
    } catch (e) {
      console.error("Error saving IQ storage:", e);
    }
  };

  // Auth Listener with Safety Timeout
  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(false);
      setHouseholdsLoading(false);
    }, 2000);

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      clearTimeout(timeout);
      setUser(u);
      if (u) {
        try {
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          if (!userDoc.exists()) {
            await setDoc(doc(db, 'users', u.uid), {
              displayName: u.displayName || 'Siswa Let Me Cook',
              photoURL: u.photoURL || ''
            });
          }
        } catch (e) {
          console.error("Error setting user doc:", e);
        }
      }
      setLoading(false);
    }, (error) => {
      console.error("Auth state error:", error);
      clearTimeout(timeout);
      setLoading(false);
    });
    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  // Demo / Guest Sign In for local preview & offline resilience
  const handleGuestSignIn = () => {
    const demoUser = {
      uid: 'demo-student-2026',
      displayName: 'Pelajar Ambis',
      email: 'pelajar@letmecook.app',
      photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'
    } as any;
    setUser(demoUser);
    setLoading(false);
  };

  // Fetch Households (Study Squads)
  useEffect(() => {
    if (!user) {
      setHouseholdsLoading(false);
      return;
    }
    setHouseholdsLoading(true);

    // If guest user or network offline, provide default local study squad
    if (user.uid === 'demo-student-2026') {
      const defaultSquad: Household = {
        id: 'local-demo-squad',
        name: 'Squad Belajar Mandiri',
        ownerId: user.uid,
        members: { [user.uid]: 'admin' }
      };
      setHouseholds([defaultSquad]);
      setSelectedHousehold(defaultSquad);
      setRecipes(STOCK_RECIPES.map((r, i) => ({
        ...r,
        id: `stock-${i}`,
        authorId: user.uid,
        householdId: 'local-demo-squad',
        createdAt: Timestamp.now()
      })) as Recipe[]);
      setHouseholdsLoading(false);
      return;
    }

    const q = query(collection(db, 'households'), where(`members.${user.uid}`, 'in', ['admin', 'member', 'viewer']));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const h = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Household));
      setHouseholds(h);
      setHouseholdsLoading(false);
      if (h.length > 0) {
        setSelectedHousehold(prev => {
          if (!prev) return h[0];
          const updated = h.find(hh => hh.id === prev.id);
          return updated || h[0];
        });
      } else {
        setSelectedHousehold(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'households');
      setHouseholdsLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // Fetch Materials / Recipes
  useEffect(() => {
    if (!user || !selectedHousehold) {
      if (user?.uid !== 'demo-student-2026') {
        setRecipes([]);
      }
      return;
    }
    if (selectedHousehold.id === 'local-demo-squad') return;

    const q = query(collection(db, 'recipes'), where('householdId', '==', selectedHousehold.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRecipes = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Recipe));
      fetchedRecipes.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || Date.now();
        const timeB = b.createdAt?.toMillis?.() || Date.now();
        return timeB - timeA;
      });
      setRecipes(fetchedRecipes);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'recipes');
    });
    return () => unsubscribe();
  }, [user, selectedHousehold]);

  // Create Study Squad / Household
  const handleCreateHousehold = async (name: string) => {
    if (!user) return;
    setIsProcessing(true);
    try {
      const newH = {
        name,
        ownerId: user.uid,
        members: { [user.uid]: 'admin' },
        createdAt: serverTimestamp()
      };

      if (user.uid === 'demo-student-2026') {
        const newLocalH = { id: `squad-${Date.now()}`, ...newH } as Household;
        setHouseholds(prev => [...prev, newLocalH]);
        setSelectedHousehold(newLocalH);
        setIsHouseholdModalOpen(false);
        setIsFirstFamilyModalOpen(true);
        setIsProcessing(false);
        return;
      }

      const docRef = await addDoc(collection(db, 'households'), newH);
      
      // Seed initial high quality study materials with quizzes
      for (const material of STOCK_RECIPES) {
        await addDoc(collection(db, 'recipes'), {
          ...material,
          authorId: user.uid,
          householdId: docRef.id,
          createdAt: serverTimestamp()
        });
      }

      setSelectedHousehold({ id: docRef.id, ...newH } as Household);
      setIsHouseholdModalOpen(false);
      setIsFirstFamilyModalOpen(true);
    } catch (error) {
      console.error("Error creating study group:", error);
      alert("Gagal membuat kelompok belajar.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteHousehold = async (householdId: string) => {
    if (!user) return;
    try {
      if (householdId === 'local-demo-squad') {
        setHouseholds([]);
        setSelectedHousehold(null);
        setIsDeleteHouseholdConfirmOpen(false);
        setIsHouseholdModalOpen(false);
        return;
      }

      const rQuery = query(collection(db, 'recipes'), where('householdId', '==', householdId));
      const rSnapshot = await getDocs(rQuery);
      for (const rDoc of rSnapshot.docs) {
        await deleteDoc(doc(db, 'recipes', rDoc.id));
      }
      await deleteDoc(doc(db, 'households', householdId));
      
      setIsDeleteHouseholdConfirmOpen(false);
      setIsHouseholdModalOpen(false);
    } catch (error) {
      console.error("Failed to delete study group:", error);
      alert("Gagal menghapus kelompok belajar. Silakan coba kembali.");
    }
  };

  // Save Learning Material
  const handleSaveRecipe = async (recipeData: Partial<Recipe>) => {
    if (!user || !selectedHousehold) return;
    
    if (!recipeData.title?.trim()) {
      setRecipeFormError("Silakan masukkan judul materi pembelajaran.");
      return;
    }
    if (!recipeData.ingredients || recipeData.ingredients.length === 0) {
      setRecipeFormError("Silakan masukkan minimal satu poin kunci materi.");
      return;
    }
    if (!recipeData.instructions || recipeData.instructions.length === 0) {
      setRecipeFormError("Silakan masukkan ringkasan atau penjelasan materi.");
      return;
    }

    setRecipeFormError(null);

    const cleanedData = Object.fromEntries(
      Object.entries(recipeData).filter(([_, v]) => v !== undefined)
    );

    try {
      if (user.uid === 'demo-student-2026') {
        if (editingRecipe?.id) {
          setRecipes(prev => prev.map(r => r.id === editingRecipe.id ? { ...r, ...cleanedData } as Recipe : r));
        } else {
          const newLocalRecipe: Recipe = {
            id: `recipe-${Date.now()}`,
            ...cleanedData,
            authorId: user.uid,
            householdId: selectedHousehold.id || 'local-demo-squad',
            createdAt: Timestamp.now(),
            rating: cleanedData.rating || 5
          } as Recipe;
          setRecipes(prev => [newLocalRecipe, ...prev]);
        }
        setIsAddModalOpen(false);
        setEditingRecipe(null);
        return;
      }

      if (editingRecipe?.id) {
        await updateDoc(doc(db, 'recipes', editingRecipe.id), {
          ...cleanedData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'recipes'), {
          ...cleanedData,
          authorId: user.uid,
          householdId: selectedHousehold.id,
          createdAt: serverTimestamp(),
          rating: cleanedData.rating || 5
        });
      }
      setIsAddModalOpen(false);
      setEditingRecipe(null);
    } catch (error) {
      console.error("Error saving study material:", error);
    }
  };

  const handleDeleteRecipe = async (id: string) => {
    try {
      if (user?.uid === 'demo-student-2026') {
        setRecipes(prev => prev.filter(r => r.id !== id));
        setViewingRecipe(null);
        setIsDeleteConfirmOpen(false);
        return;
      }
      await deleteDoc(doc(db, 'recipes', id));
      setViewingRecipe(null);
      setIsDeleteConfirmOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `recipes/${id}`);
    }
  };

  // Import Material from Web URL
  const handleImport = async () => {
    if (!importUrl) return;
    setIsProcessing(true);
    setImportError(null);
    try {
      const extracted = await extractRecipeFromUrl(importUrl);
      const imageUrl = await generateRecipeImage(extracted.title, extracted.category);
      
      setIsImportModalOpen(false);
      
      setEditingRecipe({
        ...extracted,
        id: '',
        sourceUrl: importUrl,
        imageUrl: imageUrl || '',
        category: extracted.category as Category || 'Umum',
        authorId: user?.uid || '',
        householdId: selectedHousehold?.id || '',
        createdAt: Timestamp.now()
      } as Recipe);
      
      setIsAddModalOpen(true);
      setImportUrl('');
    } catch (error) {
      console.error("Import failed:", error);
      setImportError(error instanceof Error ? error.message : "Gagal mengimpor materi. Periksa kembali tautan URL.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate Study Material with AI
  const handleGenerateRecipe = async () => {
    setIsProcessing(true);
    try {
      const material = await generateRecipe(aiCategory, aiDetails);
      const imageUrl = await generateRecipeImage(material.title, aiCategory);
      
      setIsGenerateModalOpen(false);
      
      setEditingRecipe({
        ...material,
        category: aiCategory,
        imageUrl: imageUrl || '',
        id: '',
        authorId: user?.uid || '',
        householdId: selectedHousehold?.id || '',
        createdAt: Timestamp.now()
      } as Recipe);
      
      setIsAddModalOpen(true);
      setAiDetails('');
    } catch (error) {
      console.error("Generate failed:", error);
      alert("Gagal membuat materi dengan AI. Silakan coba kembali.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddMember = async (userId: string, role: 'admin' | 'member' | 'viewer' = 'member') => {
    if (!selectedHousehold || !user || selectedHousehold.ownerId !== user.uid) return;
    try {
      const hRef = doc(db, 'households', selectedHousehold.id);
      await updateDoc(hRef, {
        [`members.${userId}`]: role
      });
    } catch (error) {
      console.error("Failed to add member:", error);
      alert("Gagal menambahkan anggota. Periksa User ID dan coba lagi.");
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedHousehold || !user || selectedHousehold.ownerId !== user.uid) return;
    if (userId === user.uid) {
      alert("Kamu tidak dapat menghapus dirimu sendiri dari kelompok belajarmu.");
      return;
    }
    try {
      const hRef = doc(db, 'households', selectedHousehold.id);
      await updateDoc(hRef, {
        [`members.${userId}`]: deleteField()
      });
    } catch (error) {
      console.error("Failed to remove member:", error);
      alert("Gagal menghapus anggota.");
    }
  };

  const handleCopyId = () => {
    if (user) {
      navigator.clipboard.writeText(user.uid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Start Interactive Quiz for viewing material
  const startQuizForMaterial = (material: Recipe) => {
    const questions = getMaterialQuiz(material);
    setQuizQuestions(questions);
    setCurrentQuestionIdx(0);
    setSelectedOptionIdx(null);
    setIsAnswerChecked(false);
    setCorrectAnswersCount(0);
    setIsQuizCompleted(false);
    setIsQuizMode(true);
  };

  const handleSelectOption = (idx: number) => {
    if (isAnswerChecked) return;
    setSelectedOptionIdx(idx);
    setIsAnswerChecked(true);

    const isCorrect = idx === quizQuestions[currentQuestionIdx].correctIndex;
    if (isCorrect) {
      setCorrectAnswersCount(prev => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIdx + 1 < quizQuestions.length) {
      setCurrentQuestionIdx(prev => prev + 1);
      setSelectedOptionIdx(null);
      setIsAnswerChecked(false);
    } else {
      // Quiz finished!
      setIsQuizCompleted(true);
      if (viewingRecipe) {
        recordQuizCompletion(viewingRecipe, correctAnswersCount, quizQuestions.length);
      }
    }
  };

  // Filtering Categories
  const categoryList = ['Semua', 'Sains', 'Teknologi', 'Matematika', 'Logika', 'Bahasa', 'Sejarah'];

  const filteredRecipes = recipes.filter(r => {
    const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         r.ingredients.some(i => i.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'Semua' || 
                            r.category.toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  // Calculate learning metrics
  const completedCount = Object.keys(quizHistory).length;
  const totalQuestionsAnswered = Object.values(quizHistory).reduce((acc, curr) => acc + curr.totalQuestions, 0);
  const totalCorrectAnswered = Object.values(quizHistory).reduce((acc, curr) => acc + curr.score, 0);
  const accuracyRate = totalQuestionsAnswered > 0 ? Math.round((totalCorrectAnswered / totalQuestionsAnswered) * 100) : 0;
  const iqTier = getIqTier(userIq);

  if (loading || (user && householdsLoading)) {
    return (
      <div className="h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950">
        <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
      </div>
    );
  }

  // --- Login / Guest Screen ---
  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex flex-col items-center justify-center p-6 font-serif">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="w-20 h-20 bg-stone-800 dark:bg-stone-100 rounded-3xl flex items-center justify-center mx-auto shadow-xl -rotate-6">
            <Flame className="w-10 h-10 text-amber-400 dark:text-stone-900" />
          </div>
          <div className="space-y-2">
            <h1 className="text-5xl font-bold text-stone-900 dark:text-stone-50 tracking-tight">Let Me Cook</h1>
            <p className="text-stone-500 dark:text-stone-400 text-lg">Ruang belajar interaktif & uji kuis cerdas untuk menaikkan skor EXP dan level kamu.</p>
          </div>
          <div className="space-y-3 pt-2">
            <Button onClick={signIn} className="w-full py-4 text-lg shadow-lg">
              Sign in with Google
            </Button>
            <Button variant="outline" onClick={handleGuestSignIn} className="w-full py-3.5 text-base border-stone-300 dark:border-stone-700">
              Coba Langsung (Mode Tamu / Demo)
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // --- Initial Setup / Create Study Squad Screen ---
  if (households.length === 0) {
    return (
      <div className="min-h-screen bg-[#f5f5f0] dark:bg-stone-950 flex flex-col items-center justify-center p-6 font-serif">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="w-20 h-20 bg-stone-800 dark:bg-stone-100 rounded-3xl flex items-center justify-center mx-auto shadow-xl -rotate-6">
            <Users className="w-10 h-10 text-stone-50 dark:text-stone-900" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-stone-900 dark:text-stone-50 tracking-tight">Buat Kelompok Belajar</h1>
            <p className="text-stone-500 dark:text-stone-400 text-lg">Kamu butuh satu kelompok belajar (Study Squad) untuk mengorganisir rangkaian materi dan kuis interaktif.</p>
          </div>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            const name = new FormData(e.currentTarget).get('name') as string;
            handleCreateHousehold(name);
          }} className="space-y-4">
            <input 
              name="name" 
              required 
              placeholder="e.g. Study Club Ambis 2026" 
              className="w-full px-6 py-4 rounded-2xl border border-stone-200 dark:border-stone-800 focus:ring-2 focus:ring-stone-800/10 dark:focus:ring-stone-100/10 outline-none bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm" 
              disabled={isProcessing} 
            />
            <Button type="submit" className="w-full py-4 text-lg shadow-lg" disabled={isProcessing}>
              {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyiapkan...</> : "Mulai Belajar (Let Me Cook!)"}
            </Button>
          </form>

          <button onClick={logOut} className="text-stone-400 hover:text-stone-600 text-sm font-medium transition-colors cursor-pointer">
            Sign out
          </button>
        </motion.div>
      </div>
    );
  }

  // --- Main App Interface ---
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#f5f5f0] dark:bg-stone-950 text-stone-800 dark:text-stone-200 font-sans pb-24 transition-colors duration-300">
      <div id="main-content">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#f5f5f0]/80 dark:bg-stone-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-stone-200/50 dark:border-stone-800/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-stone-800 dark:bg-stone-100 rounded-xl flex items-center justify-center shadow-lg -rotate-6">
            <Flame className="w-6 h-6 text-amber-400 dark:text-stone-900" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-serif font-bold tracking-tight leading-none hidden sm:block">Let Me Cook</h1>
            <span className="text-[10px] tracking-wider uppercase font-semibold text-stone-400 hidden sm:block">Level & Quiz Hub</span>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <button 
            type="button"
            onClick={() => setIsDarkMode(prev => !prev)}
            className="p-2 hover:bg-stone-200 dark:hover:bg-stone-800 rounded-full transition-colors text-stone-500 dark:text-stone-400 flex items-center justify-center cursor-pointer"
            aria-label="Toggle dark mode"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* Household / Study Squad Switcher */}
          <div className="relative group">
            <button 
              onClick={() => setIsHouseholdModalOpen(true)}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-stone-400 dark:hover:border-stone-600 transition-all shadow-sm cursor-pointer"
            >
              <Users className="w-4 h-4 text-stone-400" />
              <span className="font-medium text-xs sm:text-sm text-stone-700 dark:text-stone-200 max-w-[120px] truncate">{selectedHousehold?.name || 'Kelompok Belajar'}</span>
            </button>
          </div>
          
          {/* User Profile & IQ Badge */}
          <div className="flex items-center gap-2 pl-3 sm:pl-4 border-l border-stone-200 dark:border-stone-800">
            <button 
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center gap-2.5 p-1 sm:px-3 sm:py-1.5 rounded-full hover:bg-stone-200/60 dark:hover:bg-stone-800/60 transition-all cursor-pointer group"
              title="Buka Profil & Statistik EXP"
            >
              <img 
                src={user.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'} 
                referrerPolicy="no-referrer" 
                className="w-8 h-8 rounded-full border border-stone-200 dark:border-stone-800 object-cover group-hover:scale-105 transition-transform" 
                alt="Profile" 
              />
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-bold leading-tight text-stone-800 dark:text-stone-100">{user.displayName?.split(' ')[0]}</span>
                <span className="text-[11px] font-extrabold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Zap className="w-3 h-3 fill-current" /> EXP {userIq}
                </span>
              </div>
            </button>
            <button onClick={logOut} className="p-2 hover:bg-stone-200 dark:hover:bg-stone-800 rounded-full transition-colors cursor-pointer" title="Keluar">
              <LogOut className="w-4 h-4 text-stone-400" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Welcome & Stats Row */}
        <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-4xl font-serif font-bold text-stone-900 dark:text-stone-50">Welcome, {user.displayName?.split(' ')[0]}</h2>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold text-xs">
                <Zap className="w-3.5 h-3.5 fill-current text-amber-500" /> Lv. {iqTier.level} • {userIq} EXP
              </span>
            </div>
            <p className="text-stone-500 dark:text-stone-400 italic">Siap naik level & kumpulkan EXP hari ini? Let him cook!</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setIsGenerateModalOpen(true)} className="dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700">
              <Sparkles className="w-4 h-4 text-amber-500" /> AI Materi
            </Button>
            <Button variant="secondary" onClick={() => setIsImportModalOpen(true)} className="dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700">
              <LinkIcon className="w-4 h-4" /> Import URL
            </Button>
            <Button onClick={() => { setEditingRecipe(null); setIsAddModalOpen(true); }} className="dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200">
              <Plus className="w-4 h-4" /> Tambah Materi
            </Button>
          </div>
        </section>

        {/* Filters & Search */}
        <section className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1 lg:min-w-[400px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
            <input 
              type="text" 
              placeholder="Cari materi pembelajaran atau konsep inti..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-800/10 dark:focus:ring-stone-100/10 transition-all text-lg"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
            {categoryList.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-6 py-4 rounded-2xl whitespace-nowrap font-medium transition-all border cursor-pointer",
                  selectedCategory === cat 
                    ? "bg-stone-800 dark:bg-stone-100 text-stone-50 dark:text-stone-900 border-stone-800 dark:border-stone-100 shadow-md" 
                    : "bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-stone-800 hover:border-stone-400 dark:hover:border-stone-600"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </section>

        {/* Study Material Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredRecipes.map((material) => {
              const materialKey = material.id || material.title;
              const hasCompleted = !!quizHistory[materialKey];
              const scorePct = hasCompleted ? quizHistory[materialKey].percentage : 0;

              return (
                <motion.div
                  key={material.id || material.title}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ y: -4 }}
                  onClick={() => {
                    setViewingRecipe(material);
                    setIsQuizMode(false);
                  }}
                  className="group cursor-pointer"
                >
                  <Card className="h-full flex flex-col gap-4 overflow-hidden p-0 border-stone-200 dark:border-stone-800 hover:shadow-md transition-shadow">
                    <div className="aspect-[4/3] bg-stone-200 dark:bg-stone-800 relative overflow-hidden">
                      {material.imageUrl ? (
                        <img 
                          src={material.imageUrl} 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                          alt={material.title} 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-400 dark:text-stone-600">
                          <BookOpen className="w-12 h-12 opacity-20" />
                        </div>
                      )}

                      {/* Category Badge */}
                      <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-white/95 dark:bg-stone-900/95 backdrop-blur-sm text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-100 shadow-sm">
                        {material.category}
                      </div>

                      {/* Completed Quiz Badge */}
                      {hasCompleted && (
                        <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold tracking-wider shadow-sm flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 stroke-[3]" /> Kuis {scorePct}%
                        </div>
                      )}
                    </div>
                    <div className="p-6 pt-2 space-y-3 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-50 line-clamp-1 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                            {material.title}
                          </h3>
                          <div className="flex items-center gap-1 text-amber-500 shrink-0">
                            <Star className="w-4 h-4 fill-current" />
                            <span className="text-sm font-bold">{material.rating || 5}</span>
                          </div>
                        </div>
                        <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 mt-1">
                          {material.ingredients[0] || "Pelajari konsep inti dan selesaikan kuis evaluasi materi ini."}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-stone-400 dark:text-stone-500 text-sm pt-2 border-t border-stone-100 dark:border-stone-800">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          <span>{material.estimatedTime ? `${material.estimatedTime}m` : '15m'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-stone-600 dark:text-stone-300 font-medium">
                          <Brain className="w-4 h-4 text-amber-500" />
                          <span>{material.quiz?.length || 3} Soal Kuis</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </section>

        {filteredRecipes.length === 0 && (
          <div className="text-center py-20 space-y-4">
            <div className="w-20 h-20 bg-stone-100 dark:bg-stone-900 rounded-full flex items-center justify-center mx-auto">
              <Search className="w-8 h-8 text-stone-300 dark:text-stone-600" />
            </div>
            <h3 className="text-xl font-serif font-medium text-stone-500 dark:text-stone-400">Tidak ada materi ditemukan</h3>
            <p className="text-stone-400 dark:text-stone-500">Coba ubah kata kunci pencarian atau pilih kategori lain.</p>
          </div>
        )}
      </main>
      </div>

      {/* --- Modals Section --- */}
      
      {/* View Material & Interactive Quiz Modal */}
      <Modal 
        isOpen={!!viewingRecipe} 
        onClose={() => { 
          setViewingRecipe(null); 
          setIsDeleteConfirmOpen(false); 
          setIsQuizMode(false);
          setIsQuizCompleted(false);
        }} 
        title={viewingRecipe?.title}
      >
        <div className="space-y-6">
          {/* Header Metadata */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-stone-500 dark:text-stone-400">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-xs font-bold uppercase">{viewingRecipe?.category}</span>
              <div className="flex items-center gap-1 text-amber-500">
                <Star className="w-4 h-4 fill-current" />
                <span className="font-bold">{viewingRecipe?.rating || 5}</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <Clock className="w-3.5 h-3.5" />
                <span>{viewingRecipe?.estimatedTime ? `${viewingRecipe.estimatedTime} menit` : '15 menit'}</span>
              </div>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex bg-stone-100 dark:bg-stone-800 p-1 rounded-full text-xs font-bold">
              <button
                onClick={() => setIsQuizMode(false)}
                className={cn(
                  "px-3 py-1.5 rounded-full transition-all cursor-pointer",
                  !isQuizMode 
                    ? "bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm" 
                    : "text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
                )}
              >
                Materi Belajar
              </button>
              <button
                onClick={() => {
                  if (viewingRecipe) startQuizForMaterial(viewingRecipe);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer",
                  isQuizMode 
                    ? "bg-amber-500 text-white shadow-sm" 
                    : "text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
                )}
              >
                <Brain className="w-3.5 h-3.5" /> Kuis Soal ({viewingRecipe ? getMaterialQuiz(viewingRecipe).length : 3})
              </button>
            </div>
          </div>

          {/* Interactive Quiz Mode */}
          {isQuizMode && viewingRecipe && (
            <div className="space-y-6 pt-2">
              {!isQuizCompleted ? (
                <div className="space-y-6">
                  {/* Progress Header */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-stone-400">
                      <span>Pertanyaan {currentQuestionIdx + 1} dari {quizQuestions.length}</span>
                      <span className="text-amber-500 flex items-center gap-1">
                        <Trophy className="w-3.5 h-3.5" /> Benar: {correctAnswersCount}
                      </span>
                    </div>
                    <div className="w-full bg-stone-200 dark:bg-stone-800 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-amber-500 h-full transition-all duration-300"
                        style={{ width: `${((currentQuestionIdx + 1) / quizQuestions.length) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Question Prompt */}
                  <div className="p-6 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm">
                    <p className="text-lg md:text-xl font-serif font-bold text-stone-900 dark:text-stone-100 leading-relaxed">
                      {quizQuestions[currentQuestionIdx]?.question}
                    </p>
                  </div>

                  {/* Options List */}
                  <div className="space-y-3">
                    {quizQuestions[currentQuestionIdx]?.options.map((option, idx) => {
                      const isSelected = selectedOptionIdx === idx;
                      const isCorrect = idx === quizQuestions[currentQuestionIdx].correctIndex;
                      
                      let optionStyle = "bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:border-stone-400 dark:hover:border-stone-600";
                      if (isAnswerChecked) {
                        if (isCorrect) {
                          optionStyle = "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold";
                        } else if (isSelected) {
                          optionStyle = "bg-red-50 dark:bg-red-950/40 border-red-500 text-red-900 dark:text-red-200";
                        }
                      }

                      return (
                        <button
                          key={idx}
                          onClick={() => handleSelectOption(idx)}
                          disabled={isAnswerChecked}
                          className={cn(
                            "w-full text-left p-4 rounded-2xl border transition-all flex items-start gap-3.5 text-base cursor-pointer",
                            optionStyle
                          )}
                        >
                          <span className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5",
                            isAnswerChecked && isCorrect 
                              ? "bg-emerald-500 text-white" 
                              : isAnswerChecked && isSelected 
                                ? "bg-red-500 text-white" 
                                : "bg-stone-100 dark:bg-stone-800 text-stone-500"
                          )}>
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span className="flex-1 pt-0.5 leading-relaxed">{option}</span>
                          {isAnswerChecked && isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Feedback Explanation */}
                  {isAnswerChecked && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-sm text-stone-700 dark:text-stone-300 space-y-1"
                    >
                      <div className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                        <HelpCircle className="w-4 h-4" /> Pembahasan:
                      </div>
                      <p>{quizQuestions[currentQuestionIdx]?.explanation}</p>
                    </motion.div>
                  )}

                  {/* Next / Submit Button */}
                  {isAnswerChecked && (
                    <div className="pt-2 flex justify-end">
                      <Button onClick={handleNextQuestion} className="px-6 py-3 text-base shadow-md">
                        {currentQuestionIdx + 1 < quizQuestions.length ? (
                          <>Lanjut Soal Berikutnya <ArrowRight className="w-4 h-4" /></>
                        ) : (
                          <>Selesaikan Kuis & Dapatkan EXP <Trophy className="w-4 h-4 text-amber-400" /></>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                /* Quiz Finished Card */
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-8 px-6 bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 space-y-6 shadow-sm"
                >
                  <div className="w-20 h-20 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <Trophy className="w-10 h-10" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-3xl font-serif font-bold text-stone-900 dark:text-stone-50">Kuis Selesai!</h3>
                    <p className="text-stone-500 dark:text-stone-400 text-lg">
                      Kamu menjawab benar <span className="font-bold text-amber-600 dark:text-amber-400">{correctAnswersCount}</span> dari <span className="font-bold">{quizQuestions.length}</span> soal ({Math.round((correctAnswersCount / quizQuestions.length) * 100)}%).
                    </p>
                  </div>

                  {/* EXP Reward Notification */}
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl max-w-sm mx-auto space-y-1">
                    <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-1.5">
                      <Zap className="w-4 h-4 fill-current text-amber-500" />
                      +{recentIqGained > 0 ? recentIqGained : 1} EXP Didapatkan!
                    </div>
                    <p className="text-xs text-stone-600 dark:text-stone-400">
                      Total EXP kamu sekarang: <strong className="text-stone-900 dark:text-stone-100 font-extrabold text-sm">{userIq}</strong> ({iqTier.label})
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
                    <Button variant="secondary" onClick={() => startQuizForMaterial(viewingRecipe)}>
                      <RotateCcw className="w-4 h-4" /> Ulangi Kuis
                    </Button>
                    <Button onClick={() => setIsQuizMode(false)}>
                      <BookOpen className="w-4 h-4" /> Kembali ke Materi
                    </Button>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Reading Material Mode */}
          {!isQuizMode && viewingRecipe && (
            <div className="space-y-8">
              {viewingRecipe.imageUrl && (
                <div className="aspect-video w-full overflow-hidden rounded-2xl bg-stone-100 dark:bg-stone-800 relative">
                  <img 
                    src={viewingRecipe.imageUrl} 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover" 
                    alt={viewingRecipe.title} 
                  />
                  {/* Overlay CTA to start quiz directly */}
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-transparent to-transparent flex items-end p-6">
                    <button
                      onClick={() => startQuizForMaterial(viewingRecipe)}
                      className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-full shadow-lg flex items-center gap-2 text-sm transition-transform hover:scale-105 cursor-pointer"
                    >
                      <Brain className="w-4 h-4" /> Mulai Kuis Materi Ini ({getMaterialQuiz(viewingRecipe).length} Soal)
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Column: Key Points */}
                <div className="md:col-span-1 space-y-4">
                  <h4 className="text-lg font-serif font-bold border-b border-stone-200 dark:border-stone-800 pb-2 text-stone-900 dark:text-stone-50 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" /> Poin Kunci
                  </h4>
                  <ul className="space-y-3">
                    {viewingRecipe.ingredients.map((point, i) => (
                      <li key={i} className="flex items-start gap-2 text-stone-600 dark:text-stone-300 text-sm leading-relaxed">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Right Column: Full Study Notes */}
                <div className="md:col-span-2 space-y-4">
                  <h4 className="text-lg font-serif font-bold border-b border-stone-200 dark:border-stone-800 pb-2 text-stone-900 dark:text-stone-50 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-stone-500" /> Pembahasan & Alur Materi
                  </h4>
                  <ol className="space-y-6">
                    {viewingRecipe.instructions.map((step, i) => (
                      <li key={i} className="flex gap-4">
                        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center font-bold text-stone-500 dark:text-stone-400 text-sm">{i + 1}</span>
                        <p className="text-stone-600 dark:text-stone-300 leading-relaxed pt-1">{step}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="pt-8 border-t border-stone-200 dark:border-stone-800 flex flex-wrap justify-between items-center gap-4">
                {isDeleteConfirmOpen ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-red-600">Yakin hapus materi ini?</span>
                    <Button variant="danger" onClick={() => viewingRecipe && handleDeleteRecipe(viewingRecipe.id!)}>
                      Ya, Hapus
                    </Button>
                    <Button variant="ghost" onClick={() => setIsDeleteConfirmOpen(false)}>
                      Batal
                    </Button>
                  </div>
                ) : (
                  <Button variant="danger" onClick={() => setIsDeleteConfirmOpen(true)}>
                    <Trash2 className="w-4 h-4" /> Hapus Materi
                  </Button>
                )}

                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={() => { setEditingRecipe(viewingRecipe); setViewingRecipe(null); setIsAddModalOpen(true); }}>
                    <Edit2 className="w-4 h-4" /> Edit
                  </Button>
                  <Button onClick={() => startQuizForMaterial(viewingRecipe)} className="bg-amber-500 hover:bg-amber-600 text-white">
                    <Brain className="w-4 h-4" /> Mulai Kuis
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* --- User Profile & Level Modal --- */}
      <Modal 
        isOpen={isProfileModalOpen} 
        onClose={() => setIsProfileModalOpen(false)} 
        title="Profil & Tingkat Level Pelajar"
      >
        <div className="space-y-8">
          {/* User Header Profile */}
          <div className="flex items-center gap-4 p-4 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm">
            <img 
              src={user.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'} 
              referrerPolicy="no-referrer" 
              className="w-16 h-16 rounded-2xl object-cover border border-stone-200 dark:border-stone-700 shadow-sm" 
              alt="Profile" 
            />
            <div className="space-y-1">
              <h3 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-50">{user.displayName || 'Pelajar'}</h3>
              <p className="text-xs text-stone-400 font-mono">{user.email || user.uid}</p>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-xs font-bold">
                <Award className="w-3.5 h-3.5" /> {iqTier.label}
              </div>
            </div>
          </div>

          {/* Main EXP Dashboard Display */}
          <div className="p-6 bg-gradient-to-br from-stone-900 to-stone-800 text-white rounded-3xl shadow-xl space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs uppercase font-extrabold tracking-widest text-amber-400 flex items-center gap-1">
                  <Zap className="w-4 h-4 fill-current" /> Skor EXP & Tingkat Level
                </span>
                <div className="text-5xl font-serif font-extrabold text-stone-50 tracking-tight mt-1 flex items-baseline gap-2">
                  <span>{userIq}</span>
                  <span className="text-sm font-sans text-stone-400 font-normal">Total EXP</span>
                </div>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-stone-800/80 border border-stone-700 text-amber-400 text-xs font-bold flex items-center gap-1">
                <Award className="w-3.5 h-3.5" /> Level {iqTier.level}
              </div>
            </div>

            <p className="text-sm text-stone-300 leading-relaxed">
              {iqTier.desc}
            </p>

            {/* Scale Gauge */}
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-[11px] font-bold text-stone-400">
                <span>Lv. 1 (100)</span>
                <span>Lv. 2 (105)</span>
                <span>Lv. 3 (115)</span>
                <span>Lv. 4 (125)</span>
                <span>Lv. 5 (135+)</span>
              </div>
              <div className="w-full h-3 bg-stone-800 rounded-full overflow-hidden p-0.5 border border-stone-700">
                <div 
                  className="h-full bg-gradient-to-r from-blue-400 via-amber-400 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(10, ((userIq - 90) / 50) * 100))}%` }}
                />
              </div>
              <p className="text-[11px] text-stone-400 italic text-center pt-1">
                Rumus: Base EXP (100) + Poin Tambahan dari Akurasi Kuis untuk Naik Level.
              </p>
            </div>
          </div>

          {/* Learning Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 text-center space-y-1">
              <span className="text-xs text-stone-400 font-bold uppercase">Materi Selesai</span>
              <p className="text-2xl font-bold text-stone-900 dark:text-stone-50">{completedCount}</p>
            </div>
            <div className="p-4 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 text-center space-y-1">
              <span className="text-xs text-stone-400 font-bold uppercase">Soal Terjawab</span>
              <p className="text-2xl font-bold text-stone-900 dark:text-stone-50">{totalQuestionsAnswered}</p>
            </div>
            <div className="p-4 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 text-center space-y-1">
              <span className="text-xs text-stone-400 font-bold uppercase">Akurasi Kuis</span>
              <p className="text-2xl font-bold text-amber-500">{accuracyRate}%</p>
            </div>
            <div className="p-4 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 text-center space-y-1">
              <span className="text-xs text-stone-400 font-bold uppercase">Bonus EXP</span>
              <p className="text-2xl font-bold text-emerald-500">+{Math.max(0, userIq - 100)}</p>
            </div>
          </div>

          {/* Completed Materials & Quiz History */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-stone-400 uppercase tracking-widest">Riwayat Materi & Kuis Selesai</h4>
            {completedCount > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {Object.values(quizHistory).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3.5 bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800">
                    <div className="space-y-0.5">
                      <p className="text-sm font-bold text-stone-800 dark:text-stone-200">{item.materialTitle}</p>
                      <span className="text-[11px] text-stone-400">Skor: {item.score}/{item.totalQuestions} ({item.percentage}%)</span>
                    </div>
                    <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                      +{item.iqGained} EXP
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center rounded-2xl bg-stone-100/60 dark:bg-stone-800/60 space-y-2">
                <p className="text-sm text-stone-500">Belum ada materi atau kuis yang diselesaikan.</p>
                <p className="text-xs text-stone-400">Klik salah satu materi di beranda dan ikuti kuisnya untuk menaikkan skor EXP kamu!</p>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* --- Add / Edit Learning Material Modal --- */}
      <Modal 
        isOpen={isAddModalOpen} 
        onClose={() => { setIsAddModalOpen(false); setEditingRecipe(null); setRecipeFormError(null); }} 
        title={editingRecipe?.id ? "Edit Materi & Kuis" : "Tambah Materi Pembelajaran"}
      >
        <form 
          key={editingRecipe ? (editingRecipe.id || 'imported-' + editingRecipe.title) : 'new'}
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            handleSaveRecipe({
              title: formData.get('title') as string,
              category: formData.get('category') as Category,
              rating: Number(formData.get('rating')),
              estimatedTime: formData.get('estimatedTime') ? Number(formData.get('estimatedTime')) : 15,
              ingredients: (formData.get('ingredients') as string).split('\n').filter(i => i.trim()),
              instructions: (formData.get('instructions') as string).split('\n').filter(i => i.trim()),
              imageUrl: formData.get('imageUrl') as string,
              sourceUrl: formData.get('sourceUrl') as string,
              quiz: editingRecipe?.quiz || undefined
            });
          }} 
          className="space-y-6"
        >
          {recipeFormError && (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{recipeFormError}</p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Judul Materi</label>
              <input name="title" required defaultValue={editingRecipe?.title} placeholder="Contoh: Pengantar Machine Learning" className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-stone-800/10 outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Kategori Subjek</label>
              <select name="category" defaultValue={editingRecipe?.category || 'Teknologi'} className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-stone-800/10 outline-none">
                {categoryList.filter(c => c !== 'Semua').map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Tingkat Kesulitan (1-5)</label>
              <input name="rating" type="number" min="1" max="5" defaultValue={editingRecipe?.rating || 5} className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-stone-800/10 outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Waktu Belajar (Menit)</label>
              <input name="estimatedTime" type="number" min="1" defaultValue={editingRecipe?.estimatedTime || 15} className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-stone-800/10 outline-none" placeholder="e.g. 15" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Poin Kunci / Inti Materi (Satu poin per baris)</label>
            <textarea name="ingredients" required rows={4} defaultValue={editingRecipe?.ingredients.join('\n')} placeholder="Tuliskan poin-poin utama konsep materi..." className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-stone-800/10 outline-none" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Pembahasan Materi Lengkap (Satu alur/paragraf per baris)</label>
            <textarea name="instructions" required rows={5} defaultValue={editingRecipe?.instructions.join('\n')} placeholder="Uraikan materi penjelasan secara sistematis..." className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-stone-800/10 outline-none" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">URL Gambar (Opsional)</label>
              <input name="imageUrl" defaultValue={editingRecipe?.imageUrl} placeholder="https://..." className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-stone-800/10 outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">URL Sumber Referensi (Opsional)</label>
              <input name="sourceUrl" defaultValue={editingRecipe?.sourceUrl} placeholder="https://..." className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-stone-800/10 outline-none" />
            </div>
          </div>

          <Button type="submit" className="w-full py-4 text-lg">Simpan Materi Pembelajaran</Button>
        </form>
      </Modal>

      {/* --- Import Modal --- */}
      <Modal isOpen={isImportModalOpen} onClose={() => { setIsImportModalOpen(false); setImportError(null); }} title="Import Materi dari Web">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">URL Artikel / Jurnal Edukasi</label>
            <input 
              type="url" 
              placeholder="https://id.wikipedia.org/wiki/Kecerdasan_buatan" 
              value={importUrl}
              onChange={(e) => { setImportUrl(e.target.value); setImportError(null); }}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-stone-800/10 outline-none" 
            />
          </div>
          {importError && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p>{importError}</p>
            </div>
          )}
          <Button className="w-full py-4" onClick={handleImport} disabled={isProcessing || !importUrl}>
            {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Menganalisis Web & Menyusun Kuis...</> : "Ekstrak Materi & Kuis"}
          </Button>
          <p className="text-sm text-stone-400 text-center italic">Gemini akan merangkum konsep esensial dan otomatis menyusun pertanyaan kuis pilihan ganda.</p>
        </div>
      </Modal>

      {/* --- Generate AI Study Material Modal --- */}
      <Modal isOpen={isGenerateModalOpen} onClose={() => setIsGenerateModalOpen(false)} title="Generate Materi AI">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Kategori Materi</label>
            <select 
              value={aiCategory} 
              onChange={(e) => setAiCategory(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-stone-800/10 outline-none"
            >
              {categoryList.filter(c => c !== 'Semua').map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Topik atau Permintaan Khusus (Opsional)</label>
            <textarea 
              placeholder="e.g., Penjelasan Teori Relativitas Khusus untuk pemula, Algoritma Graph Dijkstra, Filsafat Stoikisme..."
              value={aiDetails}
              onChange={(e) => setAiDetails(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-stone-800/10 outline-none"
            />
          </div>
          <Button className="w-full py-4" onClick={handleGenerateRecipe} disabled={isProcessing}>
            {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Merancang Materi & Kuis Interaktif...</> : "Buat Materi & Kuis Cerdas"}
          </Button>
          <p className="text-sm text-stone-400 text-center italic">Gemini akan membuat modul pembelajaran komprehensif lengkap dengan soal kuis dan foto pendukung.</p>
        </div>
      </Modal>

      {/* --- Study Squad / Household Modal --- */}
      <Modal isOpen={isHouseholdModalOpen} onClose={() => setIsHouseholdModalOpen(false)} title="Kelompok Belajar Saya">
        <div className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest">Pilih Kelompok Belajar</h3>
            <div className="grid grid-cols-1 gap-2">
              {households.map(h => (
                <button
                  key={h.id}
                  onClick={() => { setSelectedHousehold(h); setIsHouseholdModalOpen(false); }}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer",
                    selectedHousehold?.id === h.id 
                      ? "bg-stone-800 dark:bg-stone-100 border-stone-800 dark:border-stone-100 text-stone-50 dark:text-stone-900" 
                      : "bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 hover:border-stone-400 text-stone-900 dark:text-stone-100"
                  )}
                >
                  <span className="font-medium">{h.name}</span>
                  {selectedHousehold?.id === h.id && <ChevronRight className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>

          {selectedHousehold && selectedHousehold.ownerId === user.uid && (
            <div className="space-y-4 pt-8 border-t border-stone-200 dark:border-stone-800">
              <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest">Undang Teman Belajar</h3>
              <p className="text-xs text-stone-400 italic">Masukkan User ID teman yang ingin kamu ajak bergabung dalam kelompok belajar.</p>
              <form onSubmit={(e) => {
                e.preventDefault();
                const uid = new FormData(e.currentTarget).get('uid') as string;
                handleAddMember(uid);
                e.currentTarget.reset();
              }} className="flex gap-2">
                <input name="uid" required placeholder="User UID" className="flex-1 px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 outline-none" />
                <Button type="submit">Undang</Button>
              </form>
              <div className="space-y-2">
                {Object.entries(selectedHousehold.members || {}).map(([uid, role]) => (
                  <div key={uid} className="flex justify-between items-center text-sm p-2 bg-white dark:bg-stone-800 rounded-lg border border-stone-100 dark:border-stone-700">
                    <span className="font-mono text-xs text-stone-400">{uid.slice(0, 8)}...</span>
                    <div className="flex items-center gap-2">
                      <span className="capitalize px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-300 text-[10px] font-bold">{role}</span>
                      {uid !== user.uid && (
                        <button 
                          onClick={() => handleRemoveMember(uid)}
                          className="text-stone-400 hover:text-red-500 transition-colors cursor-pointer"
                          title="Hapus anggota"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4 pt-8 border-t border-stone-200 dark:border-stone-800">
            <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest">User ID Saya</h3>
            <div className="flex items-center justify-between p-3 bg-stone-100 dark:bg-stone-800 rounded-xl">
              <code className="text-xs font-mono text-stone-600 dark:text-stone-300">{user.uid}</code>
              <button 
                onClick={handleCopyId}
                className="text-[10px] font-bold uppercase text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 transition-colors cursor-pointer"
              >
                {copied ? 'Tersalin!' : 'Salin'}
              </button>
            </div>
          </div>

          <div className="space-y-4 pt-8 border-t border-stone-200 dark:border-stone-800">
            <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest">Buat Kelompok Belajar Baru</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const name = new FormData(e.currentTarget).get('name') as string;
              handleCreateHousehold(name);
            }} className="flex gap-2">
              <input name="name" required placeholder="Contoh: Study Club Saintek" className="flex-1 px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 outline-none" disabled={isProcessing} />
              <Button type="submit" disabled={isProcessing}>
                {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Membuat...</> : "Buat"}
              </Button>
            </form>
          </div>

          {selectedHousehold && selectedHousehold.ownerId === user.uid && (
            <div className="pt-8 border-t border-stone-200 dark:border-stone-800 flex justify-end">
              {isDeleteHouseholdConfirmOpen ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-red-600">Yakin hapus kelompok belajar ini?</span>
                  <Button variant="danger" onClick={() => handleDeleteHousehold(selectedHousehold.id!)}>
                    Ya, Hapus
                  </Button>
                  <Button variant="secondary" onClick={() => setIsDeleteHouseholdConfirmOpen(false)}>
                    Batal
                  </Button>
                </div>
              ) : (
                <Button variant="danger" onClick={() => setIsDeleteHouseholdConfirmOpen(true)}>
                  <Trash2 className="w-4 h-4" /> Hapus Kelompok Belajar
                </Button>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Welcome / Onboarding Modal */}
      <Modal isOpen={isFirstFamilyModalOpen} onClose={() => setIsFirstFamilyModalOpen(false)} title="Selamat Datang di Let Me Cook!">
        <div className="space-y-6 text-center">
          <div className="w-16 h-16 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-amber-500" />
          </div>
          <div className="space-y-4">
            <p className="text-stone-600 dark:text-stone-300 leading-relaxed text-base">
              Kelompok belajarmu telah siap! Di sini kamu bisa membaca rangkaian materi pembelajaran terstruktur, menguji pemahaman dengan kuis soal, dan melihat skor IQ kamu meningkat secara dinamis.
            </p>
          </div>
          <Button className="w-full py-4 mt-4 text-base" onClick={() => setIsFirstFamilyModalOpen(false)}>
            Mulai Belajar (Let Him Cook!)
          </Button>
        </div>
      </Modal>
    </div>
    </ErrorBoundary>
  );
}

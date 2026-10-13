import { GoogleGenAI, Type } from "@google/genai";
import { QuizQuestion } from "../types";

const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY || '' });

export interface ExtractedRecipe {
  title: string;
  ingredients: string[]; // Poin Kunci / Rangkuman Materi
  instructions: string[]; // Materi Pembelajaran / Penjelasan
  category: string;
  estimatedTime?: number;
  quiz?: QuizQuestion[];
}

const studySchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Judul materi pembelajaran yang menarik dan edukatif" },
    ingredients: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING }, 
      description: "Daftar 4-6 poin inti atau konsep kunci dari materi ini" 
    },
    instructions: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING }, 
      description: "Daftar 4-6 paragraf penjelasan komprehensif atau langkah pemahaman konsep materi" 
    },
    category: { 
      type: Type.STRING, 
      description: "Salah satu dari: Sains, Teknologi, Matematika, Logika, Bahasa, Sejarah, Umum" 
    },
    estimatedTime: { 
      type: Type.NUMBER, 
      description: "Estimasi waktu belajar dalam menit (contoh: 15)" 
    },
    quiz: {
      type: Type.ARRAY,
      description: "3 sampai 4 pertanyaan kuis pilihan ganda yang menguji materi",
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING, description: "Pertanyaan kuis" },
          options: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING }, 
            description: "Tepat 4 pilihan jawaban (A, B, C, D)" 
          },
          correctIndex: { 
            type: Type.NUMBER, 
            description: "Indeks pilihan yang benar (0, 1, 2, atau 3)" 
          },
          explanation: { 
            type: Type.STRING, 
            description: "Penjelasan ringkas mengapa jawaban tersebut benar" 
          }
        },
        required: ["question", "options", "correctIndex", "explanation"]
      }
    }
  },
  required: ["title", "ingredients", "instructions", "category", "quiz"]
};

export async function extractRecipeFromUrl(url: string): Promise<ExtractedRecipe> {
  try {
    if (!url.startsWith('http')) {
      throw new Error("Silakan masukkan URL valid yang diawali dengan http:// atau https://");
    }

    const contents = [
      { text: `Ekstrak artikel edukasi atau materi pembelajaran dari URL berikut: ${url}` },
      { text: `Gunakan alat bantu pencarian atau pembacaan web untuk mengakses halaman di ${url}.
      Tugasmu adalah merangkum artikel tersebut menjadi modul belajar interaktif yang dilengkapi kuis soal:
      - title: Judul modul belajar
      - ingredients: 4-6 Poin kunci / ringkasan konsep esensial
      - instructions: 4-6 Bagian penjelasan mendalam dan runtut mengenai materi
      - category: Salah satu dari [Sains, Teknologi, Matematika, Logika, Bahasa, Sejarah, Umum]
      - estimatedTime: Estimasi menit untuk mempelajari materi ini (angka)
      - quiz: 3-4 Soal kuis pilihan ganda dengan 4 opsi pilihan, indeks jawaban benar (0-3), dan pembahasan.
      
      Fokuskan pada nilai edukasi yang bermanfaat bagi pelajar/mahasiswa.` }
    ];

    const response = await getAi().models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: {
        tools: [{ urlContext: {} }, { googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: studySchema
      }
    });

    const text = response.text;
    if (!text || text.trim() === "{}" || text.trim() === "[]") {
      throw new Error("AI tidak dapat membaca materi dari URL tersebut. Halaman mungkin terlindungi atau dibatasi.");
    }

    const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error("JSON Parse Error:", text);
      throw new Error("AI mengembalikan data dalam format tak terduga. Silakan coba kembali.");
    }
    
    if (!parsed.title || !parsed.ingredients || parsed.ingredients.length === 0) {
      throw new Error("AI menemukan halaman namun tidak dapat menyusun materi secara lengkap.");
    }
    
    return parsed as ExtractedRecipe;
  } catch (error) {
    console.error("Error in extractRecipeFromUrl:", error);
    if (error instanceof Error) {
      if (error.message.includes("URL") || error.message.includes("AI") || error.message.includes("format") || error.message.includes("materi")) {
        throw error;
      }
    }
    throw new Error("Terjadi kendala saat mengakses situs web tersebut. Silakan gunakan URL lain atau buat materi secara manual.");
  }
}

export async function generateRecipe(category: string, details: string): Promise<ExtractedRecipe> {
  const prompt = `Bertindaklah sebagai pendidik & pakar akademik jenius ("Let Me Cook" Academic Master). 
  Buat materi pembelajaran berkualitas tinggi untuk kategori: ${category}. 
  ${details ? `Topik spesifik atau permintaan pengguna: ${details}` : 'Pilih topik yang sangat menarik, aplikatif, dan merangsang daya pikir kritis.'}
  
  Materi harus terstruktur dengan:
  1. Judul materi yang memikat
  2. Poin-poin kunci konsep inti (ingredients)
  3. Penjelasan lengkap, logis, dan mudah dipahami (instructions)
  4. 3-4 Soal kuis pilihan ganda (quiz) yang berbobot untuk menguji pemahaman dan mengasah logika serta IQ pelajar, lengkap dengan pembahasan logis.`;

  const response = await getAi().models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: studySchema
    }
  });

  const text = response.text;
  if (!text) throw new Error("Gagal membuat materi pembelajaran dengan AI.");
  return JSON.parse(text) as ExtractedRecipe;
}

const CURATED_STUDY_IMAGES = [
  { id: 'photo-1526374965328-7f61d4dc18c5', tags: 'coding, software, programming, teknologi, algoritma, cyber' },
  { id: 'photo-1555066931-4365d14bab8c', tags: 'code, developer, computer, teknologi, web, laptop' },
  { id: 'photo-1518770660439-4636190af475', tags: 'hardware, chip, processor, circuit, teknologi, mikroprosesor' },
  { id: 'photo-1485827404703-89b55fcc595e', tags: 'robot, artificial intelligence, ai, teknologi, future' },
  { id: 'photo-1451187580459-43490279c0fa', tags: 'space, galaxy, bumi, sains, astronomy, kosmos' },
  { id: 'photo-1462331940025-496dfbfc7564', tags: 'nebula, universe, fisika, sains, bintang, teleskop' },
  { id: 'photo-1507668077129-56e32842fceb', tags: 'physics, light, prism, sains, optik, energi' },
  { id: 'photo-1532094349884-543bc11b234d', tags: 'kimia, laboratorium, sains, penelitian, biologi' },
  { id: 'photo-1635070041078-e363dbe005cb', tags: 'matematika, rumus, kalkulus, aljabar, papan tulis, angka' },
  { id: 'photo-1509228468518-180dd4864904', tags: 'matematika, kalkulasi, geometri, geometri, angka' },
  { id: 'photo-1559757175-5700dde675bc', tags: 'brain, neuron, psikologi, logika, pikiran, memori, kognitif' },
  { id: 'photo-1516321318423-f06f85e504b3', tags: 'lightbulb, idea, inovasi, logika, filsafat, berpikir' },
  { id: 'photo-1618005182384-a83a8bd57fbe', tags: 'abstract, mind, neural, logika, kecerdasan, iq' },
  { id: 'photo-1456513080510-7bf3a84b82f8', tags: 'buku, perpustakaan, bahasa, sastra, membaca, literatur' },
  { id: 'photo-1497633762265-9d179a990aa6', tags: 'books, vintage, bahasa, kamus, retorika, tulisan' },
  { id: 'photo-1524995997946-a1c2e315a42f', tags: 'library, shelves, bahasa, pengetahuan, riset' },
  { id: 'photo-1461360370896-922624d12aa1', tags: 'sejarah, map, kompas, peradaban, revolusi, masa lalu' },
  { id: 'photo-1544716278-ca5e3f4abd8c', tags: 'arsitektur, sejarah, kuno, peradaban, peninggalan' },
  { id: 'photo-1434030216411-0b793f4b4173', tags: 'belajar, study, mahasiswa, umum, ujian, catatan' },
  { id: 'photo-1513258496099-48168024aec0', tags: 'education, meja, pensil, umum, motivasi' }
];

export async function generateRecipeImage(title: string, category?: string): Promise<string | null> {
  try {
    const imageList = CURATED_STUDY_IMAGES.map((img, index) => `${index}: ${img.tags}`).join('\n');
    
    const response = await getAi().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `I have an educational learning material titled "${title}" in category "${category || 'Umum'}". 
      Below is a list of high-quality study and science images with their tags:
      ${imageList}
      
      Pick the index of the image that best matches this learning subject.
      Output ONLY the index number (integer), nothing else.`,
    });
    
    const indexStr = response.text.trim();
    const index = parseInt(indexStr);
    
    if (!isNaN(index) && index >= 0 && index < CURATED_STUDY_IMAGES.length) {
      return `https://images.unsplash.com/${CURATED_STUDY_IMAGES[index].id}?auto=format&fit=crop&q=80&w=1000`;
    }
    
    throw new Error("Invalid index returned");
  } catch (error) {
    console.error("Failed to select curated image:", error);
    const categoryLower = (category || '').toLowerCase();
    const categoryMatch = CURATED_STUDY_IMAGES.find(img => img.tags.includes(categoryLower));
    const fallbackId = categoryMatch ? categoryMatch.id : CURATED_STUDY_IMAGES[0].id;
    return `https://images.unsplash.com/${fallbackId}?auto=format&fit=crop&q=80&w=1000`;
  }
}

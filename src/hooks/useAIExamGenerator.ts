import { useState, useCallback } from 'react';
import { groq, groqSafe } from '../lib/groq';

// ─── Types ───
export interface AIReadingExam {
  id: string;
  level: string;
  title: string;
  passage: string;
  questions: {
    id: string;
    text: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
  }[];
}

export interface AIListeningExam {
  id: string;
  level: string;
  title: string;
  transcript: string;
  questions: {
    id: string;
    text: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
  }[];
}

export interface AIWritingExam {
  id: string;
  level: string;
  title: string;
  prompt: string;
  minWords: number;
}

// ─── Topics ───
export const EXAM_TOPICS = [
  { key: 'random', label: '🎲 Ngẫu nhiên' },
  { key: 'daily_life', label: '🏠 Cuộc sống hàng ngày' },
  { key: 'travel', label: '✈️ Du lịch' },
  { key: 'work', label: '💼 Công việc' },
  { key: 'technology', label: '💻 Công nghệ' },
  { key: 'health', label: '🏥 Sức khỏe' },
  { key: 'environment', label: '🌿 Môi trường' },
  { key: 'education', label: '📚 Giáo dục' },
  { key: 'culture', label: '🎭 Văn hóa & Nghệ thuật' },
  { key: 'food', label: '🍽️ Ẩm thực' },
  { key: 'sport', label: '⚽ Thể thao' },
];

// ─── Detailed DELF format guidance per level ───
const DELF_READING: Record<string, string> = {
  'A1': `DELF A1 - Compréhension des écrits:
- Document types: Carte postale, petite annonce, menu de restaurant, formulaire simple, panneau d'information, SMS/message court, affiche d'événement.
- Passage length: 60-100 words maximum.
- Grammar: Présent de l'indicatif ONLY. "Je m'appelle...", "Il y a...", "C'est...".
- Vocabulary: Famille, nationalités, professions, nourriture, jours/mois, nombres, couleurs, objets quotidiens.
- Questions: Very factual (qui, quoi, où, quand). "Quel est le numéro de téléphone ?", "À quelle heure...?"
- 3-4 questions, 3 options each (A, B, C). Very short, clear options.`,

  'A2': `DELF A2 - Compréhension des écrits:
- Document types: Email amical, programme de sortie, publicité, article de magazine simple, notice/mode d'emploi court, invitation.
- Passage length: 100-160 words.
- Grammar: Présent + passé composé + futur proche. "On va faire...", "J'ai visité...", "Il faut...".
- Vocabulary: Loisirs, voyages, achats, météo, logement, transports en commun, santé de base.
- Questions: Factual + simple inference. "Pourquoi est-ce que...?", "Que doit faire...?"
- 4 questions, 4 options each. Options are short sentences.`,

  'B1': `DELF B1 - Compréhension des écrits:
- Document types: Article de presse/blog, courrier formel, texte argumentatif court, témoignage, critique de film/livre, rapport/compte-rendu simplifié.
- Passage length: 180-280 words.
- Grammar: All indicatif tenses (présent, passé composé, imparfait, plus-que-parfait, futur). Conditionnel présent. Connecteurs logiques (cependant, en revanche, par conséquent, d'une part...d'autre part).
- Vocabulary: Vie professionnelle, actualité, opinions, sentiments, relations sociales, environnement.
- Questions: Comprehension + inference + opinion detection. "Selon l'auteur...", "Quelle est l'opinion de...?"
- 4-5 questions, 4 options each. Options may be longer phrases.`,

  'B2': `DELF B2 - Compréhension des écrits:
- Document types: Article de fond (Le Monde, Le Figaro style), essai argumentatif, éditorial, lettre ouverte, texte littéraire adapté, analyse sociétale.
- Passage length: 250-400 words.
- Grammar: All tenses including subjonctif (bien que, pour que, il est possible que). Conditionnel passé. Phrases complexes avec relatives (dont, auquel). Voix passive. Discours rapporté.
- Vocabulary: Abstrait (la mondialisation, l'enjeu, la problématique), registre soutenu, nuances (néanmoins, toutefois, en dépit de, force est de constater).
- Questions: Deep analysis, implicit meaning, author's stance, logical structure. "Que sous-entend l'auteur ?", "Quel est le ton de ce passage ?"
- 5 questions, 4 options each. Options are nuanced and require careful reading.`,
};

const DELF_LISTENING: Record<string, string> = {
  'A1': `DELF A1 - Compréhension de l'oral:
- Scenario types: Message sur répondeur, annonce dans un magasin, dialogue simple à la boulangerie/gare, météo très simple.
- Transcript length: 40-70 words. Very slow, clear speech.
- Grammar: Présent only. Very short sentences with pauses.
- Topics: Heure, prix, adresse, numéro de téléphone, rendez-vous.
- 3-4 questions, 3 options. Very concrete answers (numbers, places, times).`,

  'A2': `DELF A2 - Compréhension de l'oral:
- Scenario types: Conversation téléphonique, annonce à la gare/aéroport, message vocal, dialogue au restaurant/hôtel, instructions simples.
- Transcript length: 80-120 words. Clear speech with natural rhythm.
- Grammar: Présent + passé composé + futur proche. Quelques expressions courantes.
- Topics: Réservation, programme de la journée, problème quotidien, invitation.
- 4 questions, 4 options. Factual + simple reasoning.`,

  'B1': `DELF B1 - Compréhension de l'oral:
- Scenario types: Interview radio, reportage court, conversation entre amis/collègues, message professionnel, émission de conseil.
- Transcript length: 120-180 words. Natural speech speed with varied intonation.
- Grammar: Multiple tenses. Connecteurs (donc, alors, par contre). Expressions idiomatiques courantes.
- Topics: Vie professionnelle, loisirs, projets, actualité, expériences personnelles.
- 4-5 questions, 4 options. Comprehension + inference.`,

  'B2': `DELF B2 - Compréhension de l'oral:
- Scenario types: Débat radio/TV, conférence/exposé, interview approfondie, documentaire, discussion argumentée.
- Transcript length: 180-250 words. Natural conversational speed with nuances.
- Grammar: All tenses, subjonctif, conditionnel. Registre soutenu. Argumentation structurée.
- Topics: Débats de société, analyses politiques/économiques, enjeux culturels, innovations.
- 5 questions, 4 options. Deep analysis, implicit meaning, speaker's position.`,
};

const DELF_WRITING: Record<string, string> = {
  'A1': `DELF A1 - Production écrite:
- Task types: Remplir un formulaire, écrire une carte postale, SMS/message court à un ami.
- Word count: 40-50 mots.
- Expected content: Informations personnelles, décrire brièvement une situation très simple.`,

  'A2': `DELF A2 - Production écrite:
- Task types: Écrire un email/lettre amicale, raconter un événement simple, accepter/refuser une invitation, décrire son logement/quartier.
- Word count: 60-80 mots.
- Expected content: Raconter au passé composé, exprimer un souhait simple, donner des détails concrets.`,

  'B1': `DELF B1 - Production écrite:
- Task types: Lettre formelle de réclamation, email au directeur, essai donnant son opinion, article de blog.
- Word count: 160-180 mots.
- Expected content: Exprimer et justifier une opinion, proposer des solutions, utiliser des connecteurs logiques, registre formel/informel selon la situation.`,

  'B2': `DELF B2 - Production écrite:
- Task types: Lettre formelle argumentée, article critique, essai structuré (introduction, développement, conclusion), courrier de protestation.
- Word count: 250+ mots.
- Expected content: Argumentation structurée avec thèse/antithèse, exemples concrets, registre soutenu, nuances et concessions.`,
};

// ─── Hook ───
export function useAIExamGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedExam, setGeneratedExam] = useState<any>(null);
  const [genError, setGenError] = useState('');

  const generateReadingExam = useCallback(async (level: string, topic: string): Promise<AIReadingExam | null> => {
    setIsGenerating(true);
    setGenError('');
    setGeneratedExam(null);

    const topicInstruction = topic === 'random'
      ? 'Pick any interesting topic that would appeal to a French language learner.'
      : `Topic: ${topic}. Create content related to this theme.`;

    try {
      const completion = await groqSafe(() => groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are an official DELF exam creator (Centre international d'études pédagogiques). Generate a complete French reading comprehension exam that follows the EXACT format and difficulty of a real DELF ${level} exam.

${DELF_READING[level] || ''}

${topicInstruction}

CRITICAL RULES:
1. Follow the DELF ${level} format EXACTLY as described above (document type, passage length, grammar, vocabulary).
2. The passage must read like a real DELF exam document — coherent, realistic, and well-structured.
3. All questions must be in French. Explanations must be in French.
4. The title should be in French and describe the document.
5. correctAnswer is a 0-based index (0 = first option, 1 = second, etc.).

Return JSON:
{
  "title": "French title",
  "passage": "Full French text passage...",
  "questions": [
    {
      "id": "q1",
      "text": "Question in French?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Explanation in French..."
    }
  ]
}
Return valid JSON only.`
          },
          { role: "user", content: `Generate a DELF ${level} reading comprehension exam.` }
        ],
        model: "llama-3.1-8b-instant",
        response_format: { type: "json_object" },
        temperature: 0.85,
      }));

      const raw = completion.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(raw);
      const exam: AIReadingExam = {
        id: `ai-read-${Date.now()}`,
        level,
        title: parsed.title || 'Đề AI',
        passage: parsed.passage || '',
        questions: (parsed.questions || []).map((q: any, i: number) => ({
          id: q.id || `q${i + 1}`,
          text: q.text || '',
          options: q.options || [],
          correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : 0,
          explanation: q.explanation || '',
        })),
      };

      setGeneratedExam(exam);
      setIsGenerating(false);
      return exam;
    } catch (e: any) {
      console.error('AI Reading generation error', e);
      setGenError('Không thể tạo đề. Vui lòng thử lại!');
      setIsGenerating(false);
      return null;
    }
  }, []);

  const generateListeningExam = useCallback(async (level: string, topic: string): Promise<AIListeningExam | null> => {
    setIsGenerating(true);
    setGenError('');
    setGeneratedExam(null);

    const topicInstruction = topic === 'random'
      ? 'Pick any realistic listening scenario (radio announcement, phone call, conversation, etc.).'
      : `Topic: ${topic}. Create a realistic audio scenario related to this theme.`;

    try {
      const completion = await groqSafe(() => groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are an official DELF exam creator. Generate a French LISTENING comprehension exam following the EXACT format of a real DELF ${level} exam.

IMPORTANT: This transcript will be READ ALOUD by a Text-to-Speech engine, so:
- Use proper punctuation (commas, periods, question marks) to create natural pauses.
- Write in a style that sounds natural when spoken (not written language).
- For dialogues, use "—" to separate speakers and write each speaker's lines clearly.

${DELF_LISTENING[level] || ''}

${topicInstruction}

CRITICAL RULES:
1. Follow the DELF ${level} listening format EXACTLY (scenario type, transcript length, grammar level).
2. The scenario must be realistic and match what you'd hear in a real DELF exam.
3. All questions and explanations must be in French.
4. correctAnswer is a 0-based index.

Return JSON:
{
  "title": "French scenario title (e.g. 'Message sur le répondeur du médecin')",
  "transcript": "Full French transcript with proper punctuation for TTS...",
  "questions": [
    {
      "id": "q1",
      "text": "Question in French?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Explanation in French..."
    }
  ]
}
Return valid JSON only.`
          },
          { role: "user", content: `Generate a DELF ${level} listening comprehension exam.` }
        ],
        model: "llama-3.1-8b-instant",
        response_format: { type: "json_object" },
        temperature: 0.85,
      }));

      const raw = completion.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(raw);
      const exam: AIListeningExam = {
        id: `ai-list-${Date.now()}`,
        level,
        title: parsed.title || 'Đề Nghe AI',
        transcript: parsed.transcript || '',
        questions: (parsed.questions || []).map((q: any, i: number) => ({
          id: q.id || `q${i + 1}`,
          text: q.text || '',
          options: q.options || [],
          correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : 0,
          explanation: q.explanation || '',
        })),
      };

      setGeneratedExam(exam);
      setIsGenerating(false);
      return exam;
    } catch (e: any) {
      console.error('AI Listening generation error', e);
      setGenError('Không thể tạo đề. Vui lòng thử lại!');
      setIsGenerating(false);
      return null;
    }
  }, []);

  const generateWritingExam = useCallback(async (level: string, topic: string): Promise<AIWritingExam | null> => {
    setIsGenerating(true);
    setGenError('');
    setGeneratedExam(null);

    const topicInstruction = topic === 'random'
      ? 'Pick any realistic writing situation appropriate for this DELF level.'
      : `Topic: ${topic}. Create a writing prompt related to this theme.`;

    const minWordsMap: Record<string, number> = { 'A1': 40, 'A2': 60, 'B1': 160, 'B2': 250 };

    try {
      const completion = await groqSafe(() => groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are an official DELF exam creator. Generate a French WRITING exam prompt following the EXACT format of a real DELF ${level} exam.

${DELF_WRITING[level] || ''}

${topicInstruction}

CRITICAL RULES:
1. Follow the DELF ${level} writing format EXACTLY (task type, word count, expected content).
2. The prompt must be entirely in French, describing a realistic situation.
3. Include specific instructions: who to write to, what to include, the expected format.
4. Match the DELF style: "Vous êtes...", "Vous écrivez à...", "Vous devez...".
5. The title should be a short French description of the task.

Return JSON:
{
  "title": "Short French title describing the task",
  "prompt": "Full writing prompt in French, DELF style, with detailed situation and instructions...",
  "minWords": ${minWordsMap[level] || 160}
}
Return valid JSON only.`
          },
          { role: "user", content: `Generate a DELF ${level} writing exam prompt.` }
        ],
        model: "llama-3.1-8b-instant",
        response_format: { type: "json_object" },
        temperature: 0.85,
      }));

      const raw = completion.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(raw);
      const exam: AIWritingExam = {
        id: `ai-write-${Date.now()}`,
        level,
        title: parsed.title || 'Đề Viết AI',
        prompt: parsed.prompt || '',
        minWords: parsed.minWords || minWordsMap[level] || 160,
      };

      setGeneratedExam(exam);
      setIsGenerating(false);
      return exam;
    } catch (e: any) {
      console.error('AI Writing generation error', e);
      setGenError('Không thể tạo đề. Vui lòng thử lại!');
      setIsGenerating(false);
      return null;
    }
  }, []);

  const clearGenerated = useCallback(() => {
    setGeneratedExam(null);
    setGenError('');
  }, []);

  return {
    isGenerating,
    generatedExam,
    genError,
    generateReadingExam,
    generateListeningExam,
    generateWritingExam,
    clearGenerated,
  };
}

import mammoth from 'mammoth';
import { Type } from '@google/genai';
import { GEMINI_TEXT_MODEL, getGeminiClient, withRetry } from '../lib/gemini.ts';
import { CandidateProfile, CandidateProfileSchema } from '../../src/shared/types.ts';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

export const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function validateResumeFile(file: { originalname: string; mimetype: string; size: number }): void {
  const lower = file.originalname.toLowerCase();
  const validExt = lower.endsWith('.pdf') || lower.endsWith('.docx') || lower.endsWith('.txt');
  if (!validExt && !ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new Error('Unsupported file format. Please upload a PDF or DOCX resume.');
  }
  if (file.size <= 0) {
    throw new Error('Uploaded file is empty.');
  }
  if (file.size > MAX_RESUME_SIZE_BYTES) {
    throw new Error('File exceeds the 5 MB size limit.');
  }
}

export function cleanExtractedText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function extractTextFromResume(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  const lower = fileName.toLowerCase();
  let rawText = '';

  if (lower.endsWith('.pdf') || mimeType === 'application/pdf') {
    const pdfParseModule = await import('pdf-parse');
    const PDFParseCtor = (pdfParseModule as unknown as {
      PDFParse?: new (opts: { data: Buffer | Uint8Array }) => {
        getText: () => Promise<{ text: string }>;
        destroy?: () => Promise<void>;
      };
    }).PDFParse;

    if (!PDFParseCtor) {
      throw new Error('PDF parser is unavailable in the server runtime.');
    }

    const parser = new PDFParseCtor({ data: new Uint8Array(buffer) });
    try {
      const parsed = await parser.getText();
      rawText = parsed.text || '';
    } finally {
      if (typeof parser.destroy === 'function') {
        await parser.destroy().catch(() => {});
      }
    }
  } else if (
    lower.endsWith('.docx') ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    rawText = result.value || '';
  } else if (lower.endsWith('.txt') || mimeType === 'text/plain') {
    rawText = buffer.toString('utf-8');
  } else {
    throw new Error('Unsupported file format. Please upload a PDF or DOCX resume.');
  }

  const cleaned = cleanExtractedText(rawText);
  if (cleaned.length < 30) {
    throw new Error('Could not extract readable text from the uploaded resume. Ensure the document is not a scanned image without text.');
  }
  return cleaned;
}

export async function parseResumeToProfile(
  extractedText: string,
  userId: string
): Promise<CandidateProfile> {
  const ai = getGeminiClient();

  const systemInstruction = [
    'You are a strict, factual resume parser for CareerMatch AI.',
    'Extract ONLY information explicitly present in the resume text.',
    'NEVER invent, infer, or guess skills, projects, degrees, companies, experience durations, or preferred roles.',
    'If a string field is missing or uncertain, output "Unknown".',
    'If experienceMonths cannot be determined from explicit dates/durations, output null.',
    'If experienceLevel cannot be determined, output "unknown".',
    'Keep arrays empty if no evidence exists in the text.',
  ].join(' ');

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: `Extract structured candidate profile data from this resume:\n\n---\n${extractedText.slice(0, 18000)}\n---`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fullName: { type: Type.STRING },
            headline: { type: Type.STRING },
            experienceLevel: {
              type: Type.STRING,
              enum: ['intern', 'fresher', 'entry', 'mid', 'unknown'],
            },
            experienceMonths: { type: Type.NUMBER, nullable: true },
            education: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  institution: { type: Type.STRING },
                  degree: { type: Type.STRING },
                  field: { type: Type.STRING },
                  graduationYear: { type: Type.STRING },
                  gpa: { type: Type.STRING },
                },
                required: ['institution', 'degree'],
              },
            },
            skills: { type: Type.ARRAY, items: { type: Type.STRING } },
            programmingLanguages: { type: Type.ARRAY, items: { type: Type.STRING } },
            frameworksAndTools: { type: Type.ARRAY, items: { type: Type.STRING } },
            projects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  technologies: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['name', 'summary'],
              },
            },
            internships: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  role: { type: Type.STRING },
                  organization: { type: Type.STRING },
                  duration: { type: Type.STRING },
                  highlights: { type: Type.STRING },
                },
                required: ['role', 'organization'],
              },
            },
            preferredRoles: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: [
            'fullName',
            'experienceLevel',
            'skills',
            'programmingLanguages',
            'frameworksAndTools',
            'education',
            'projects',
            'internships',
            'preferredRoles',
          ],
        },
      },
    })
  );

  const rawJson = (response.text ?? '{}').trim();
  const parsedJson = JSON.parse(rawJson);

  // Merge languages & frameworks into combined deduplicated skills list while preserving source categories
  const combinedSkills = Array.from(
    new Set([
      ...(Array.isArray(parsedJson.skills) ? parsedJson.skills : []),
      ...(Array.isArray(parsedJson.programmingLanguages) ? parsedJson.programmingLanguages : []),
      ...(Array.isArray(parsedJson.frameworksAndTools) ? parsedJson.frameworksAndTools : []),
    ].map((s: unknown) => String(s).trim()).filter(Boolean))
  );

  const validated = CandidateProfileSchema.parse({
    ...parsedJson,
    skills: combinedSkills,
    userId,
    confirmed: false,
    updatedAt: new Date().toISOString(),
  });

  return validated;
}

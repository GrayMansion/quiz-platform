import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  displayName: z.string().min(1, 'Display name is required').max(100),
  role: z.enum(['PARTICIPANT', 'ORGANIZER']),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export const createQuizSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  category: z.string().max(100).optional(),
  defaultTimeLimit: z.number().int().min(5).max(300).optional(),
  defaultPoints: z.number().int().min(1).max(1000).optional(),
  rules: z.string().max(2000).optional(),
});

export const updateQuizSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  category: z.string().max(100).optional(),
  defaultTimeLimit: z.number().int().min(5).max(300).optional(),
  defaultPoints: z.number().int().min(1).max(1000).optional(),
  rules: z.string().max(2000).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
});

export const createQuestionSchema = z.object({
  position: z.number().int().min(0),
  type: z.enum(['SINGLE_CHOICE', 'MULTIPLE_CHOICE']),
  text: z.string().min(1, 'Question text is required'),
  imageUrl: z.string().optional(),
  timeLimit: z.number().int().min(5).max(300).optional(),
  points: z.number().int().min(1).max(1000).optional(),
  options: z
    .array(
      z.object({
        text: z.string().min(1),
        imageUrl: z.string().optional(),
        isCorrect: z.boolean(),
        position: z.number().int().min(0),
      })
    )
    .min(2, 'At least 2 options required'),
});

export const updateQuestionSchema = z.object({
  type: z.enum(['SINGLE_CHOICE', 'MULTIPLE_CHOICE']).optional(),
  text: z.string().min(1).optional(),
  imageUrl: z.string().optional(),
  timeLimit: z.number().int().min(5).max(300).optional(),
  points: z.number().int().min(1).max(1000).optional(),
  options: z
    .array(
      z.object({
        text: z.string().min(1),
        imageUrl: z.string().optional(),
        isCorrect: z.boolean(),
        position: z.number().int().min(0),
      })
    )
    .min(2)
    .optional(),
});

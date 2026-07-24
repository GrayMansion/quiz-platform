import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding demo quizzes...\n');

  // Create demo organizer if not exists
  let organizer = await prisma.user.findUnique({
    where: { email: 'demo@quiz.platform' },
  });

  if (!organizer) {
    organizer = await prisma.user.create({
      data: {
        email: 'demo@quiz.platform',
        passwordHash: await bcrypt.hash('demo123', 12),
        displayName: 'Professor Quizick',
        role: 'ORGANIZER',
      },
    });
    console.log('Created organizer: demo@quiz.platform / demo123 (Professor Quizick)');
  } else {
    console.log('Demo organizer already exists');
  }

  // ===== Quiz 1: "Which country this food is from?" =====
  await createQuiz(organizer.id, {
    title: 'Which Country Is This Food From?',
    description: 'Test your knowledge of international cuisine! Can you guess which country each famous dish originates from?',
    category: 'Food & Geography',
    defaultTimeLimit: 20,
    defaultPoints: 100,
    rules: 'Select the correct country for each food item.',
    questions: [
      {
        text: 'Where does sushi originate from?',
        type: 'SINGLE_CHOICE',
        options: [
          { text: 'China', correct: false },
          { text: 'Japan', correct: true },
          { text: 'Korea', correct: false },
          { text: 'Thailand', correct: false },
        ],
      },
      {
        text: 'Paella is a traditional dish from which country?',
        type: 'SINGLE_CHOICE',
        options: [
          { text: 'Italy', correct: false },
          { text: 'Portugal', correct: false },
          { text: 'Spain', correct: true },
          { text: 'Greece', correct: false },
        ],
      },
      {
        text: 'Which country is famous for poutine?',
        type: 'SINGLE_CHOICE',
        options: [
          { text: 'United States', correct: false },
          { text: 'Canada', correct: true },
          { text: 'France', correct: false },
          { text: 'Belgium', correct: false },
        ],
      },
      {
        text: 'Kimchi is a staple food in which country?',
        type: 'SINGLE_CHOICE',
        options: [
          { text: 'Vietnam', correct: false },
          { text: 'China', correct: false },
          { text: 'Japan', correct: false },
          { text: 'South Korea', correct: true },
        ],
      },
      {
        text: 'Where does the croissant originally come from?',
        type: 'SINGLE_CHOICE',
        options: [
          { text: 'France', correct: false },
          { text: 'Austria', correct: true },
          { text: 'Germany', correct: false },
          { text: 'Switzerland', correct: false },
        ],
      },
    ],
  });

  // ===== Quiz 2: "Fun facts about computers." =====
  await createQuiz(organizer.id, {
    title: 'Fun Facts About Computers',
    description: 'How much do you really know about computers? From history to hardware — test your tech trivia!',
    category: 'Technology',
    defaultTimeLimit: 25,
    defaultPoints: 100,
    rules: 'Pick the correct answer for each computer trivia question.',
    questions: [
      {
        text: 'What was the name of the first electronic general-purpose computer?',
        type: 'SINGLE_CHOICE',
        options: [
          { text: 'UNIVAC', correct: false },
          { text: 'ENIAC', correct: true },
          { text: 'IBM PC', correct: false },
          { text: 'Apple I', correct: false },
        ],
      },
      {
        text: 'How much did the first 1GB hard drive weigh?',
        type: 'SINGLE_CHOICE',
        options: [
          { text: 'About 1 kg', correct: false },
          { text: 'About 5 kg', correct: false },
          { text: 'About 250 kg', correct: true },
          { text: 'About 0.5 kg', correct: false },
        ],
      },
      {
        text: 'Which programming language was created first?',
        type: 'SINGLE_CHOICE',
        options: [
          { text: 'FORTRAN', correct: true },
          { text: 'C', correct: false },
          { text: 'Python', correct: false },
          { text: 'Java', correct: false },
        ],
      },
      {
        text: 'What does "HTTP" stand for?',
        type: 'SINGLE_CHOICE',
        options: [
          { text: 'HyperText Transfer Protocol', correct: true },
          { text: 'High Tech Transfer Process', correct: false },
          { text: 'HyperText Translation Protocol', correct: false },
          { text: 'Home Tool Transfer Protocol', correct: false },
        ],
      },
      {
        text: 'In what year was the World Wide Web invented?',
        type: 'SINGLE_CHOICE',
        options: [
          { text: '1985', correct: false },
          { text: '1989', correct: true },
          { text: '1995', correct: false },
          { text: '1979', correct: false },
        ],
      },
    ],
  });

  // ===== Quiz 3: "The best way to do that." =====
  await createQuiz(organizer.id, {
    title: 'The Best Way to Do That',
    description: 'Everyday problems, optimal solutions. Test your practical problem-solving skills!',
    category: 'Life Hacks',
    defaultTimeLimit: 20,
    defaultPoints: 100,
    rules: 'Choose the most effective or scientifically proven answer.',
    questions: [
      {
        text: 'What is the best way to cool down a hot drink quickly?',
        type: 'SINGLE_CHOICE',
        options: [
          { text: 'Blow on it', correct: false },
          { text: 'Put it in the freezer', correct: false },
          { text: 'Pour it between two cups', correct: true },
          { text: 'Add cold water', correct: false },
        ],
      },
      {
        text: 'What is the most effective way to learn a new language?',
        type: 'SINGLE_CHOICE',
        options: [
          { text: 'Read a textbook cover to cover', correct: false },
          { text: 'Watch movies with subtitles', correct: false },
          { text: 'Spaced repetition + conversation practice', correct: true },
          { text: 'Memorize 100 words per day', correct: false },
        ],
      },
      {
        text: 'What is the best method to fall asleep faster?',
        type: 'SINGLE_CHOICE',
        options: [
          { text: 'Count sheep', correct: false },
          { text: 'Watch TV in bed', correct: false },
          { text: 'Progressive muscle relaxation', correct: true },
          { text: 'Exercise right before bed', correct: false },
        ],
      },
      {
        text: 'What is the best way to preserve battery life on a smartphone?',
        type: 'SINGLE_CHOICE',
        options: [
          { text: 'Always close background apps', correct: false },
          { text: 'Keep charge between 20% and 80%', correct: true },
          { text: 'Charge to 100% every time', correct: false },
          { text: 'Use battery saver mode 24/7', correct: false },
        ],
      },
      {
        text: 'What is the most efficient way to read and retain information from a book?',
        type: 'SINGLE_CHOICE',
        options: [
          { text: 'Read it in one sitting', correct: false },
          { text: 'Highlight every paragraph', correct: false },
          { text: 'Active recall + spaced repetition', correct: true },
          { text: 'Listen to the audiobook at 3x speed', correct: false },
        ],
      },
    ],
  });

  console.log('\n✅ Demo quizzes seeded successfully!');
  console.log('   Login: demo@quiz.platform / demo123');
  console.log('   Or register your own organizer account.\n');
}

async function createQuiz(
  organizerId: string,
  data: {
    title: string;
    description: string;
    category: string;
    defaultTimeLimit: number;
    defaultPoints: number;
    rules: string;
    questions: Array<{
      text: string;
      type: string;
      options: Array<{ text: string; correct: boolean }>;
    }>;
  }
) {
  // Check if quiz already exists
  const existing = await prisma.quiz.findFirst({
    where: { title: data.title, organizerId },
  });
  if (existing) {
    console.log(`  ⏭  Quiz "${data.title}" already exists, skipping.`);
    return;
  }

  const quiz = await prisma.quiz.create({
    data: {
      organizerId,
      title: data.title,
      description: data.description,
      category: data.category,
      defaultTimeLimit: data.defaultTimeLimit,
      defaultPoints: data.defaultPoints,
      rules: data.rules,
      status: 'PUBLISHED',
      questions: {
        create: data.questions.map((q, qi) => ({
          position: qi,
          type: q.type as any,
          text: q.text,
          options: {
            create: q.options.map((o, oi) => ({
              text: o.text,
              isCorrect: o.correct,
              position: oi,
            })),
          },
        })),
      },
    },
    include: { questions: true },
  });

  console.log(`  ✅ "${data.title}" — ${quiz.questions.length} questions`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

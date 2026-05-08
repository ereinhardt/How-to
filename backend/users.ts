import generate_question from "../ai/ai";
import { extractDurationInSec } from "../util/m3u8_operations";
import { debug_error } from "../util/util";

enum UserState {
  Unset,
  generateQuestions,
}

// Represents a single question with metadata
class Question {
  public question: string;
  public id: string;
  public startTimeInSec: number;

  // Create a new question with all required properties
  constructor(q: string, id: string, startTimeInSec: number) {
    this.question = q;
    this.id = id;
    this.startTimeInSec = startTimeInSec;
  }
}

// Manages user state and question chains for streaming
export default class User {
  public id: string;
  public highestRequestedFile = 0;
  public highestAddedToPlaylist = -1;
  public generatedFollowingQuestions = false;
  public state = UserState.Unset;
  public questions: Question[] = [];
  public current_question_index = 0;

  // Initialize a new user with the given ID
  constructor(id: string) {
    this.id = id;
  }

  // Reset user state for a new search
  reset() {
    this.highestRequestedFile = 0;
    this.highestAddedToPlaylist = -1;
    this.generatedFollowingQuestions = false;
    this.state = UserState.Unset;
    this.questions = [];
    this.current_question_index = 0;
  }

  // Generate AI-powered question chain from starting question
  async generateUpcommingQuestions(start_question: string) {
    if (
      this.state == UserState.generateQuestions ||
      this.generatedFollowingQuestions
    )
      return;
    this.state = UserState.generateQuestions;
    this.generatedFollowingQuestions = true;

    try {
      const questions = await generate_question(start_question);
      let i = 1;

      let startTime = 0;

      for (const q of questions) {
        const question = q[`video_title_${i}`];
        const id = q[`video_id_${i}`];
        const durationInSec = extractDurationInSec(id);
        this.questions.push(new Question(question, id, startTime));
        startTime += durationInSec;
        i++;
      }
    } catch (error: any) {
      this.state = UserState.Unset;
      this.generatedFollowingQuestions = false;
      throw error;
    }
  }

  // Get the currently active question
  getCurrentQuestion(): Question {
    return this.questions[this.current_question_index];
  }

  // Move to next question in the chain
  getNewQuestion() {
    this.current_question_index += 1;

    if (this.current_question_index >= this.questions.length) return null;

    return this.questions[this.current_question_index];
  }
}

// Check if user already exists in the users array
export function user_allready_saved(user: User[], user_id: string): boolean {
  return user.find((u) => u.id === user_id) != undefined;
}

// Find and return user by ID from users array
export function get_user_by_id(users: User[], user_id: string): User | null {
  const foundUser = users.find((u) => u.id === user_id);
  if (!foundUser) {
    debug_error(`CRITICAL: User with ID ${user_id} not found!`);
    return null;
  }
  return foundUser;
}

// Remove user from users array by ID
export function remove_user_by_id(user: User[], user_id: string): void {
  const user_index = user.findIndex((u) => u.id == user_id);

  if (user_index < 0) return;

  user.splice(user_index, 1);
}

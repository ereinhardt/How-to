import generate_question from "../ai/ai";
import { extractDurationInSec } from "../util/m3u8_operations";

enum UserState {
  Unset,
  generateQuestions,
}

class Question {
  public index: number;
  public question: string;
  public id: string;
  public durationInSec: number;
  public startTimeInSec: number;

  constructor(
    i: number,
    q: string,
    id: string,
    durationInSec: number,
    startTimeInSec: number
  ) {
    this.index = i;
    this.question = q;
    this.id = id;
    this.durationInSec = durationInSec;
    this.startTimeInSec = startTimeInSec;
  }
}

export default class User {
  public id: string;
  public highestRequestedFile = 0;
  public highestAddedToPlaylist = -1; // Track highest segment added to M3U8 playlist
  public generatedFollowingQuestions = false;
  public state = UserState.Unset;
  public questions: Question[] = [];
  public current_question_index = 0;

  constructor(id: string) {
    this.id = id;
  }

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
        this.questions.push(
          new Question(i, question, id, durationInSec, startTime)
        );
        startTime += durationInSec;
        i++;
      }
    } catch (error: any) {
      // Reset state so user can try again
      this.state = UserState.Unset;
      this.generatedFollowingQuestions = false;
      throw error; // Re-throw to be handled by socket handler
    }
  }

  getCurrentQuestion(): Question {
    return this.questions[this.current_question_index];
  }

  getNewQuestion() {
    this.current_question_index += 1;

    if (this.current_question_index >= this.questions.length) return null;

    return this.questions[this.current_question_index];
  }

  resetQuestions() {
    this.questions = [];
    this.state = UserState.Unset;
    this.generatedFollowingQuestions = false;
  }
}

export function user_allready_saved(user: User[], user_id: string): boolean {
  return user.find((u) => u.id === user_id) != undefined;
}
export function get_user_by_id(user: User[], user_id: string): User {
  return user.find((u) => u.id === user_id)!;
}

export function remove_user_by_id(user: User[], user_id: string): void {
  const user_index = user.findIndex((u) => u.id == user_id);

  if (user_index < 0) return;

  user.splice(user_index, 1);
}

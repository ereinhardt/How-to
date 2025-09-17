import generate_question from "../ai/ai";

enum UserState {
  Unset,
  generateQuestions,
}

class Question {
  public index: number;
  public question: string;
  public id: string;

  constructor(i: number, q: string, id: string) {
    this.index = i;
    this.question = q;
    this.id = id;
  }
}

export default class User {
  public id: string;
  public highestRequestedFile = 0;
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
    const questions = await generate_question(start_question);
    let i = 1;

    for (const q of questions) {
      const question = q[`video_title_${i}`];
      const id = q[`video_id_${i}`];
      this.questions.push(new Question(i, question, id));
      i++;
    }
  }

  getNewQuestion() {
    this.current_question_index += 1;

    if (this.current_question_index > this.questions.length) {
      this.current_question_index = 0;
      const last_question = this.questions[this.questions.length - 1].question;
      this.resetQuestions();
      this.generateUpcommingQuestions(last_question);
      return this.questions[0];
    }

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

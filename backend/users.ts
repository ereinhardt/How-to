export default class User {
  public id: string;
  public highestRequestedFile = 0;

  constructor(id: string) {
    this.id = id;
  }
}

export function user_allready_saved(user: User[], user_id: string): boolean {
  return user.find((u) => u.id === user_id) != undefined;
}

export function get_user_by_id(user: User[], user_id: string): User {
  return user.find((u) => u.id === user_id)!;
}

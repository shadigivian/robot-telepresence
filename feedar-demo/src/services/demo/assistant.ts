import type { AssistantAnswer } from '../../domain/models';
import type { AIProvider, Store } from '../contracts';
import { answerFromKnowledge } from '../../domain/assistant';
export { answerFromKnowledge } from '../../domain/assistant';
export class DemoAssistant implements AIProvider {
  constructor(private readonly store:Store){}
  async answer(organizationId:string,question:string,language:'en'|'fa'|'tr'='en'):Promise<AssistantAnswer>{
    return answerFromKnowledge(await this.store.read(),organizationId,question,language);
  }
}

declare module '@langchain/openai' {
  export class ChatOpenAI {
    constructor(options: {
      modelName?: string
      temperature?: number
      openAIApiKey: string
      configuration?: {
        baseURL?: string
        [key: string]: any
      }
      [key: string]: any
    })

    invoke(messages: any[]): Promise<{
      content: string | any
      [key: string]: any
    }>
  }
}

declare module '@langchain/core/messages' {
  export class BaseMessage {
    content: string | any
    _getType(): string
  }

  export class HumanMessage extends BaseMessage {
    constructor(content: string)
  }

  export class AIMessage extends BaseMessage {
    constructor(content: string)
  }

  export class SystemMessage extends BaseMessage {
    constructor(content: string)
  }
}

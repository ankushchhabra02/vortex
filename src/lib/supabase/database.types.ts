export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      knowledge_bases: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          knowledge_base_id: string
          title: string
          content: string | null
          source_url: string | null
          file_path: string | null
          file_type: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          knowledge_base_id: string
          title: string
          content?: string | null
          source_url?: string | null
          file_path?: string | null
          file_type?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          knowledge_base_id?: string
          title?: string
          content?: string | null
          source_url?: string | null
          file_path?: string | null
          file_type?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      document_chunks: {
        Row: {
          id: string
          document_id: string
          chunk_text: string
          chunk_index: number
          embedding: number[] | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          chunk_text: string
          chunk_index: number
          embedding?: number[] | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          chunk_text?: string
          chunk_index?: number
          embedding?: number[] | null
          metadata?: Json | null
          created_at?: string
        }
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          knowledge_base_id: string | null
          title: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          knowledge_base_id?: string | null
          title?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          knowledge_base_id?: string | null
          title?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          role?: 'user' | 'assistant' | 'system'
          content?: string
          metadata?: Json | null
          created_at?: string
        }
      }
    }
    Functions: {
      match_document_chunks: {
        Args: {
          query_embedding: number[]
          match_threshold?: number
          match_count?: number
          kb_id?: string | null
        }
        Returns: {
          id: string
          document_id: string
          chunk_text: string
          similarity: number
        }[]
      }
    }
  }
}

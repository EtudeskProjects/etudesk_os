/**
 * Neo4j Client - Singleton connection manager
 */

import neo4j, { Driver, Session, Result, QueryResult, RecordShape, Integer } from 'neo4j-driver';
import { GRAPH_CONSTRAINTS, GRAPH_INDEXES } from './ontology';

import { logger } from '../../utils';
// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface Neo4jConfig {
  uri: string;
  user: string;
  password: string;
  database?: string;
}

export interface QueryOptions {
  database?: string;
}

// ═══════════════════════════════════════════════════════════════
// NEO4J CLIENT SINGLETON
// ═══════════════════════════════════════════════════════════════

class Neo4jClient {
  private driver: Driver | null = null;
  private config: Neo4jConfig | null = null;
  private initialized = false;

  /**
   * Initialize the Neo4j driver with configuration
   */
  async initialize(config?: Neo4jConfig): Promise<void> {
    if (this.initialized && this.driver) {
      logger.info('[Neo4j] Client already initialized');
      return;
    }

    this.config = config ?? {
      uri: process.env.NEO4J_URI ?? 'bolt://localhost:7687',
      user: process.env.NEO4J_USER ?? 'neo4j',
      password: process.env.NEO4J_PASSWORD ?? 'password',
      database: process.env.NEO4J_DATABASE ?? 'neo4j',
    };

    try {
      logger.info(`[Neo4j] Connecting to ${this.config.uri}...`);

      this.driver = neo4j.driver(
        this.config.uri,
        neo4j.auth.basic(this.config.user, this.config.password),
        {
          maxConnectionPoolSize: 50,
          connectionAcquisitionTimeout: 30000,
          connectionTimeout: 30000,
          logging: {
            level: 'warn',
            logger: (level, message) => logger.info(`[Neo4j][${level}] ${message}`),
          },
        }
      );

      // Verify connectivity
      await this.driver.verifyConnectivity();
      logger.info('[Neo4j] Connection verified successfully');

      // Initialize schema
      await this.initializeSchema();

      this.initialized = true;
      logger.info('[Neo4j] Client initialized successfully');
    } catch (error) {
      logger.error('[Neo4j] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Initialize graph schema (constraints and indexes)
   */
  private async initializeSchema(): Promise<void> {
    logger.info('[Neo4j] Initializing schema...');

    const session = this.getSession();
    try {
      // Create constraints
      for (const constraint of GRAPH_CONSTRAINTS) {
        try {
          await session.run(constraint);
        } catch (error: any) {
          // Ignore if constraint already exists
          if (!error.message?.includes('already exists')) {
            logger.warn(`[Neo4j] Constraint warning: ${error.message}`);
          }
        }
      }

      // Create indexes
      for (const index of GRAPH_INDEXES) {
        try {
          await session.run(index);
        } catch (error: any) {
          // Ignore if index already exists
          if (!error.message?.includes('already exists')) {
            logger.warn(`[Neo4j] Index warning: ${error.message}`);
          }
        }
      }

      logger.info('[Neo4j] Schema initialized');
    } finally {
      await session.close();
    }
  }

  /**
   * Get the Neo4j driver instance
   */
  getDriver(): Driver {
    if (!this.driver) {
      throw new Error('[Neo4j] Client not initialized. Call initialize() first.');
    }
    return this.driver;
  }

  /**
   * Get a new session
   */
  getSession(options?: QueryOptions): Session {
    const driver = this.getDriver();
    return driver.session({
      database: options?.database ?? this.config?.database ?? 'neo4j',
    });
  }

  /**
   * Execute a read query
   */
  async read(
    cypher: string,
    params: Record<string, any> = {},
    options?: QueryOptions
  ): Promise<QueryResult> {
    const session = this.getSession(options);
    try {
      return await session.executeRead(tx => tx.run(cypher, params));
    } finally {
      await session.close();
    }
  }

  /**
   * Execute a write query
   */
  async write(
    cypher: string,
    params: Record<string, any> = {},
    options?: QueryOptions
  ): Promise<QueryResult> {
    const session = this.getSession(options);
    try {
      return await session.executeWrite(tx => tx.run(cypher, params));
    } finally {
      await session.close();
    }
  }

  /**
   * Create a Neo4j integer from a JavaScript number
   */
  int(value: number): Integer {
    return neo4j.int(value);
  }

  /**
   * Execute multiple write queries in a transaction
   */
  async writeTransaction(
    queries: Array<{ cypher: string; params?: Record<string, any> }>,
    options?: QueryOptions
  ): Promise<void> {
    const session = this.getSession(options);
    try {
      await session.executeWrite(async tx => {
        for (const { cypher, params } of queries) {
          await tx.run(cypher, params ?? {});
        }
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.initialized && this.driver !== null;
  }

  /**
   * Get connection status
   */
  async getStatus(): Promise<{ connected: boolean; database?: string; serverInfo?: any }> {
    if (!this.driver) {
      return { connected: false };
    }

    try {
      const serverInfo = await this.driver.getServerInfo();
      return {
        connected: true,
        database: this.config?.database,
        serverInfo: {
          address: serverInfo.address,
          protocolVersion: serverInfo.protocolVersion,
        },
      };
    } catch {
      return { connected: false };
    }
  }

  /**
   * Close the driver connection
   */
  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
      this.initialized = false;
      logger.info('[Neo4j] Connection closed');
    }
  }
}

// Export singleton instance
export const neo4jClient = new Neo4jClient();

// Export types for external use
export type { Driver, Session, Result, QueryResult } from 'neo4j-driver';

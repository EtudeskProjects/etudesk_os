/**
 * SQL Query Builder utilities for dynamic query construction
 */

export type QueryParam = string | number | boolean | null | string[] | number[];

export interface QueryBuilder {
  sql: string;
  params: QueryParam[];
  paramIndex: number;
}

/**
 * Create a new query builder
 */
export function createQueryBuilder(baseSql: string, initialParams: QueryParam[] = []): QueryBuilder {
  return {
    sql: baseSql,
    params: [...initialParams],
    paramIndex: initialParams.length + 1,
  };
}

/**
 * Add a WHERE condition
 */
export function addCondition(
  builder: QueryBuilder,
  condition: string,
  value: QueryParam,
  operator: 'AND' | 'OR' = 'AND'
): QueryBuilder {
  const placeholder = `$${builder.paramIndex}`;
  const conditionSql = condition.replace('?', placeholder);

  return {
    sql: `${builder.sql} ${operator} ${conditionSql}`,
    params: [...builder.params, value],
    paramIndex: builder.paramIndex + 1,
  };
}

/**
 * Add multiple LIKE conditions with OR (for search across columns)
 */
export function addSearchCondition(
  builder: QueryBuilder,
  columns: string[],
  value: string
): QueryBuilder {
  if (columns.length === 0) return builder;

  const placeholder = `$${builder.paramIndex}`;
  const conditions = columns.map(col => `${col} ILIKE '%' || ${placeholder} || '%'`).join(' OR ');

  return {
    sql: `${builder.sql} AND (${conditions})`,
    params: [...builder.params, value],
    paramIndex: builder.paramIndex + 1,
  };
}

/**
 * Add ORDER BY clause
 */
export function addOrderBy(
  builder: QueryBuilder,
  column: string,
  direction: 'ASC' | 'DESC' = 'DESC',
  nullsLast = true
): QueryBuilder {
  const nullsClause = nullsLast ? ' NULLS LAST' : '';
  const hasOrderBy = builder.sql.includes('ORDER BY');
  const separator = hasOrderBy ? ',' : ' ORDER BY';

  return {
    ...builder,
    sql: `${builder.sql}${separator} ${column} ${direction}${nullsClause}`,
  };
}

/**
 * Add LIMIT and OFFSET
 */
export function addPagination(
  builder: QueryBuilder,
  limit: number,
  offset: number
): QueryBuilder {
  return {
    sql: `${builder.sql} LIMIT $${builder.paramIndex} OFFSET $${builder.paramIndex + 1}`,
    params: [...builder.params, limit, offset],
    paramIndex: builder.paramIndex + 2,
  };
}

/**
 * Finalize and get the query
 */
export function finalizeQuery(builder: QueryBuilder): { sql: string; params: QueryParam[] } {
  return {
    sql: builder.sql,
    params: builder.params,
  };
}

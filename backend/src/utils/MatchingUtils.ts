export interface MatchCriteria {
    city?: string;
    region?: string;
    country?: string;
    remote?: boolean;
    sectors?: string[];
    profileType?: string; // e.g., 'freelance', 'employee'
    objectives?: string[];
    query?: string; // General search query
}

export interface TableMapping {
    city?: string;
    region?: string;
    country?: string;
    locationType?: 'json' | 'text';
    remoteReady?: string;
    willingToRelocate?: string;
    sectors?: string;
    sectorsType?: 'text[]' | 'jsonb';
    bio?: string;
    goals?: string;
}

/**
 * Result of a parameterized SQL fragment builder.
 * sql: the SQL expression (with $N placeholders)
 * params: the parameter values to bind
 */
export interface SqlFragment {
    sql: string;
    params: unknown[];
}

const TABLE_MAPPINGS: Record<string, TableMapping> = {
    't': { // talents
        city: 'city',
        region: 'region',
        country: 'country',
        remoteReady: 'remote_ready',
        willingToRelocate: 'willing_to_relocate',
        sectors: 'sectors',
        sectorsType: 'text[]',
        bio: 'bio',
        goals: 'goals'
    },
    's': { // spaces
        city: 'city',
        region: 'region',
        country: 'country',
        sectors: 'sectors',
        sectorsType: 'text[]',
        bio: 'description'
    },
    'c': { // communities
        city: 'city',
        region: 'region',
        country: 'country',
        sectors: 'sectors',
        sectorsType: 'jsonb',
        bio: 'description'
    },
    'o': { // opportunities (legacy alias, now 'opp')
        sectors: 'sectors',
        sectorsType: 'text[]',
        bio: 'summary'
    },
    'opp': { // Explicit opportunities alias
        city: 'locations',
        region: 'locations',
        country: 'locations',
        locationType: 'json',
        sectors: 'sectors',
        sectorsType: 'text[]',
        bio: 'summary',
    },
    'org': { // Organizations mapping
        city: 'headquarters_city',
        region: 'headquarters_region',
        country: 'headquarters_country',
        sectors: 'sectors',
        sectorsType: 'text[]',
        bio: 'description',
        goals: 'goals'
    }
};

export class MatchingUtils {
    /**
     * Internal helper to get mapping for an alias
     */
    private static getMapping(tableAlias: string): TableMapping {
        if (TABLE_MAPPINGS[tableAlias]) return TABLE_MAPPINGS[tableAlias];
        return {};
    }

    /**
     * Generates a parameterized SQL ORDER BY clause fragment for location-based ranking.
     * Returns both the SQL fragment and the parameter values.
     * @param startIndex - the starting $N index for parameters
     */
    static buildLocationRanking(tableAlias: string, criteria: MatchCriteria, startIndex: number = 1): SqlFragment {
        const parts: string[] = [];
        const params: unknown[] = [];
        const mapping = this.getMapping(tableAlias);
        const isJson = mapping.locationType === 'json';
        let idx = startIndex;

        // 1. Exact City Match
        if (criteria.city && mapping.city) {
            if (isJson) {
                parts.push(`CASE WHEN ${tableAlias}.${mapping.city} @> jsonb_build_array(jsonb_build_object('city', $${idx})) THEN 4 ELSE 0 END`);
                params.push(criteria.city);
                idx++;
            } else {
                parts.push(`CASE WHEN LOWER(${tableAlias}.${mapping.city}) = LOWER($${idx}) THEN 4 ELSE 0 END`);
                params.push(criteria.city);
                idx++;
            }
        }

        // 2. Exact Region Match
        if (criteria.region && mapping.region) {
            if (isJson) {
                parts.push(`CASE WHEN ${tableAlias}.${mapping.region} @> jsonb_build_array(jsonb_build_object('region', $${idx})) THEN 3 ELSE 0 END`);
                params.push(criteria.region);
                idx++;
            } else {
                parts.push(`CASE WHEN LOWER(${tableAlias}.${mapping.region}) = LOWER($${idx}) THEN 3 ELSE 0 END`);
                params.push(criteria.region);
                idx++;
            }
        }

        // 3. Exact Country Match
        if (criteria.country && mapping.country) {
            if (isJson) {
                parts.push(`CASE WHEN ${tableAlias}.${mapping.country} @> jsonb_build_array(jsonb_build_object('country', $${idx})) THEN 2 ELSE 0 END`);
                params.push(criteria.country);
                idx++;
            } else {
                parts.push(`CASE WHEN LOWER(${tableAlias}.${mapping.country}) = LOWER($${idx}) THEN 2 ELSE 0 END`);
                params.push(criteria.country);
                idx++;
            }
        }

        // Remote handling
        if (criteria.remote && mapping.remoteReady) {
            parts.push(`CASE WHEN ${tableAlias}.${mapping.remoteReady} = TRUE THEN 2 ELSE 0 END`);
        }

        // Willing to relocate boost
        if ((criteria.city || criteria.region || criteria.country) && mapping.willingToRelocate) {
            parts.push(`CASE WHEN ${tableAlias}.${mapping.willingToRelocate} = TRUE THEN 1 ELSE 0 END`);
        }

        return {
            sql: parts.length > 0 ? `(${parts.join(' + ')})` : '0',
            params
        };
    }

    /**
     * Generates a parameterized SQL ORDER BY clause fragment for sector matching.
     * @param startIndex - the starting $N index for parameters
     */
    static buildSectorRanking(tableAlias: string, sectors: string[] | undefined, startIndex: number = 1): SqlFragment {
        if (!sectors || sectors.length === 0) return { sql: '0', params: [] };
        const mapping = this.getMapping(tableAlias);
        if (!mapping.sectors) return { sql: '0', params: [] };

        const params: unknown[] = [];
        const placeholders: string[] = [];
        let idx = startIndex;

        for (const sector of sectors) {
            placeholders.push(`$${idx}`);
            params.push(sector);
            idx++;
        }

        if (mapping.sectorsType === 'jsonb') {
            return {
                sql: `CASE WHEN ${tableAlias}.${mapping.sectors} ?| ARRAY[${placeholders.join(',')}]::text[] THEN 2 ELSE 0 END`,
                params
            };
        }

        return {
            sql: `CASE WHEN ${tableAlias}.${mapping.sectors} && ARRAY[${placeholders.join(',')}]::text[] THEN 2 ELSE 0 END`,
            params
        };
    }

    /**
     * Generates a parameterized SQL ORDER BY clause fragment for profile/objective matching.
     * @param startIndex - the starting $N index for parameters
     */
    static buildProfileRanking(tableAlias: string, query: string | undefined, startIndex: number = 1): SqlFragment {
        if (!query) return { sql: '0', params: [] };
        const mapping = this.getMapping(tableAlias);
        const params: unknown[] = [];
        const parts: string[] = [];
        let idx = startIndex;

        const likePattern = `%${query}%`;

        if (mapping.bio) {
            parts.push(`CASE WHEN ${tableAlias}.${mapping.bio} ILIKE $${idx} THEN 1 ELSE 0 END`);
            params.push(likePattern);
            idx++;
        }

        if (mapping.goals) {
            if (mapping.sectorsType === 'jsonb') {
                parts.push(`CASE WHEN EXISTS (SELECT 1 FROM jsonb_array_elements_text(${tableAlias}.${mapping.goals}) g WHERE g ILIKE $${idx}) THEN 1 ELSE 0 END`);
            } else {
                parts.push(`CASE WHEN EXISTS (SELECT 1 FROM unnest(${tableAlias}.${mapping.goals}) g WHERE g ILIKE $${idx}) THEN 1 ELSE 0 END`);
            }
            params.push(likePattern);
            idx++;
        }

        return {
            sql: parts.length > 0 ? `(${parts.join(' + ')})` : '0',
            params
        };
    }

    /**
     * Combines all rankings into a single parameterized score expression.
     * @param startIndex - the starting $N index for parameters
     */
    static buildMatchScore(tableAlias: string, criteria: MatchCriteria, startIndex: number = 1): SqlFragment {
        const location = this.buildLocationRanking(tableAlias, criteria, startIndex);
        const nextIdx1 = startIndex + location.params.length;

        const sector = this.buildSectorRanking(tableAlias, criteria.sectors, nextIdx1);
        const nextIdx2 = nextIdx1 + sector.params.length;

        const profile = this.buildProfileRanking(tableAlias, criteria.query, nextIdx2);

        return {
            sql: `(${location.sql} * 10) + (${sector.sql} * 5) + (${profile.sql} * 1)`,
            params: [...location.params, ...sector.params, ...profile.params]
        };
    }
}

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
        // This entry is kept for backward compatibility if 'o' is still used for opportunities
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
        // Try to guess if not explicitly in the map
        if (TABLE_MAPPINGS[tableAlias]) return TABLE_MAPPINGS[tableAlias];

        // Fallback or guess by alias if possible, but default to empty
        return {};
    }

    /**
     * Generates a SQL ORDER BY clause fragment for location-based ranking.
     */
    static buildLocationRanking(tableAlias: string, criteria: MatchCriteria): string {
        const parts: string[] = [];
        const mapping = this.getMapping(tableAlias);
        const isJson = mapping.locationType === 'json';

        // 1. Exact City Match
        if (criteria.city && mapping.city) {
            if (isJson) {
                // Check if any object in the JSONB array has this city
                const safeCity = criteria.city.replace(/'/g, "''");
                parts.push(`CASE WHEN ${tableAlias}.${mapping.city} @> '[{"city": "${safeCity}"}]'::jsonb THEN 4 ELSE 0 END`);
            } else {
                parts.push(`CASE WHEN LOWER(${tableAlias}.${mapping.city}) = LOWER('${criteria.city.replace(/'/g, "''")}') THEN 4 ELSE 0 END`);
            }
        }

        // 2. Exact Region Match
        if (criteria.region && mapping.region) {
            if (isJson) {
                const safeRegion = criteria.region.replace(/'/g, "''");
                parts.push(`CASE WHEN ${tableAlias}.${mapping.region} @> '[{"region": "${safeRegion}"}]'::jsonb THEN 3 ELSE 0 END`);
            } else {
                parts.push(`CASE WHEN LOWER(${tableAlias}.${mapping.region}) = LOWER('${criteria.region.replace(/'/g, "''")}') THEN 3 ELSE 0 END`);
            }
        }

        // 3. Exact Country Match
        if (criteria.country && mapping.country) {
            if (isJson) {
                const safeCountry = criteria.country.replace(/'/g, "''");
                parts.push(`CASE WHEN ${tableAlias}.${mapping.country} @> '[{"country": "${safeCountry}"}]'::jsonb THEN 2 ELSE 0 END`);
            } else {
                parts.push(`CASE WHEN LOWER(${tableAlias}.${mapping.country}) = LOWER('${criteria.country.replace(/'/g, "''")}') THEN 2 ELSE 0 END`);
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

        return parts.length > 0 ? `(${parts.join(' + ')})` : '0';
    }

    /**
     * Generates a SQL ORDER BY clause fragment for sector matching.
     */
    static buildSectorRanking(tableAlias: string, sectors?: string[]): string {
        if (!sectors || sectors.length === 0) return '0';
        const mapping = this.getMapping(tableAlias);
        if (!mapping.sectors) return '0';

        const formattedSectors = sectors.map(s => `'${s.replace(/'/g, "''")}'`).join(',');

        if (mapping.sectorsType === 'jsonb') {
            // Updated overlap check for JSONB
            return `CASE WHEN ${tableAlias}.${mapping.sectors} ?| ARRAY[${formattedSectors}]::text[] THEN 2 ELSE 0 END`;
        }

        return `CASE WHEN ${tableAlias}.${mapping.sectors} && ARRAY[${formattedSectors}]::text[] THEN 2 ELSE 0 END`;
    }

    /**
   * Generates a SQL ORDER BY clause fragment for profile/objective matching.
   */
    static buildProfileRanking(tableAlias: string, query?: string): string {
        if (!query) return '0';
        const mapping = this.getMapping(tableAlias);
        const safeQuery = query.replace(/'/g, "''");

        const parts: string[] = [];

        if (mapping.bio) {
            parts.push(`CASE WHEN ${tableAlias}.${mapping.bio} ILIKE '%${safeQuery}%' THEN 1 ELSE 0 END`);
        }

        if (mapping.goals) {
            // Check if goals is text[] or jsonb
            if (mapping.sectorsType === 'jsonb') { // Reusing sector type logic or could have goalsType
                parts.push(`CASE WHEN EXISTS (SELECT 1 FROM jsonb_array_elements_text(${tableAlias}.${mapping.goals}) g WHERE g ILIKE '%${safeQuery}%') THEN 1 ELSE 0 END`);
            } else {
                // Assuming text[]
                parts.push(`CASE WHEN EXISTS (SELECT 1 FROM unnest(${tableAlias}.${mapping.goals}) g WHERE g ILIKE '%${safeQuery}%') THEN 1 ELSE 0 END`);
            }
        }

        return parts.length > 0 ? `(${parts.join(' + ')})` : '0';
    }

    /**
     * Combines all rankings into a single score expression.
     */
    static buildMatchScore(tableAlias: string, criteria: MatchCriteria): string {
        const locationScore = this.buildLocationRanking(tableAlias, criteria);
        const sectorScore = this.buildSectorRanking(tableAlias, criteria.sectors);
        const profileScore = this.buildProfileRanking(tableAlias, criteria.query);

        return `(${locationScore} * 10) + (${sectorScore} * 5) + (${profileScore} * 1)`;
    }
}

import { useEffect, useState } from 'react';
import { api } from '../api';
import type { CatalogResponse, Spacecraft } from '../interfaces/types';

/** The static catalogue, fetched once. A null `catalog` means still loading. */
export function useCatalogue() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [fleet, setFleet] = useState<Spacecraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.planets(), api.spacecraft()])
      .then(([planets, spacecraft]) => {
        setCatalog(planets);
        setFleet(spacecraft);
      })
      .catch(() => setError('Could not reach the API. Is it running on port 3000?'));
  }, []);

  return { catalog, fleet, error };
}

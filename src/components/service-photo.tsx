'use client';
import { useEffect, useState } from 'react';
import { Flower2 } from 'lucide-react';
import type { Service } from '@/lib/types';

export function ServicePhoto({
  service,
  className = '',
}: {
  service: Pick<Service, 'name' | 'photo_url' | 'color'>;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [service.photo_url]);
  return (
    <span className={`service-photo ${className}`} style={{ background: service.color }}>
      {service.photo_url && !failed ? (
        <img
          src={service.photo_url}
          alt={`Foto de ${service.name}`}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <Flower2 size={25} strokeWidth={1.2} aria-hidden="true" />
      )}
    </span>
  );
}

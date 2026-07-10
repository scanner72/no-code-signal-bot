// Composition point for optional cloud pages and nodes.
// The open-source core ships with empty lists; a downstream distribution
// can register extra routes, nav sections, a landing page and node
// components here without touching core files.
import type { ComponentType, LazyExoticComponent, ReactNode } from 'react';

export const CLOUD_HOME = '/dashboard';

export const CloudLanding: LazyExoticComponent<ComponentType<any>> | null = null;

export const cloudRoutes: { path: string; Component: LazyExoticComponent<ComponentType<any>> }[] = [];

export const getCloudNavSections = (_t: (key: string) => string): { title: string; items: { id: string; icon: ReactNode; label: string }[] }[] => [];

export const cloudNodeTypes: Record<string, ComponentType<any>> = {};

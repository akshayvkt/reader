declare module 'epubjs' {
  export default class ePub {
    constructor(url: string | ArrayBuffer, options?: { openAs?: 'binary' | 'base64' | 'epub' | 'opf' | 'json' | 'directory' });
    renderTo(element: string | HTMLElement, options?: {
      width?: string | number;
      height?: string | number;
      flow?: string;
      spread?: string;
      minSpreadWidth?: number;
    }): Rendition;
    ready: Promise<void>;
    loaded: {
      navigation: Promise<Navigation>;
      metadata: Promise<Metadata>;
    };
    navigation: Navigation;
    locations: Locations;
    spine: Spine;
    package?: unknown;
  }

  export interface Locations {
    generate(chars?: number): Promise<string[]>;
    locationFromCfi(cfi: string): number;
    cfiFromLocation(location: number): string;
    cfiFromPercentage(percentage: number): string;
    percentageFromCfi(cfi: string): number;
    total: number;
    save(): string;
    load(locations: string): void;
  }

  export interface Spine {
    get(target: string | number): SpineItem | undefined;
    each(callback: (item: SpineItem, index: number) => void): void;
    items: SpineItem[];
  }

  export interface SpineItem {
    href: string;
    cfi: string;
    index: number;
  }

  export interface Rendition {
    display(target?: string | number): Promise<void>;
    next(): Promise<void>;
    prev(): Promise<void>;
    on(event: string, callback: (...args: unknown[]) => void): void;
    off(event: string, callback: (...args: unknown[]) => void): void;
    currentLocation(): Location;
    destroy(): void;
    resize(width: number, height: number): void;
    getContents(): Contents[];
    themes: Themes;
  }

  export interface Themes {
    default(styles: Record<string, Record<string, string>>): void;
    fontSize(size: string): void;
    font(fontFamily: string): void;
    override(name: string, value: string): void;
    overrides(styles: Record<string, string>): void;
  }

  export interface Contents {
    document: Document;
    window: Window;
  }

  export interface Navigation {
    toc: TocItem[];
  }

  export interface TocItem {
    id: string;
    href: string;
    label: string;
    subitems?: TocItem[];
  }

  export interface Metadata {
    title: string;
    creator: string;
    description: string;
    pubdate: string;
    publisher: string;
    identifier: string;
    language: string;
    rights: string;
    modified_date: string;
    layout: string;
    orientation: string;
    spread: string;
    direction: string;
  }

  export interface Location {
    start: {
      cfi: string;
      href: string;
      displayed: {
        page: number;
        total: number;
      };
    };
    end: {
      cfi: string;
      href: string;
      displayed: {
        page: number;
        total: number;
      };
    };
  }
}
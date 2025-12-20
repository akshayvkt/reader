export interface RecentBook {
  id: string;              // hash of file content (byteLength for now)
  title: string;
  author: string;
  coverUrl: string | null; // base64 data URL or null
  lastOpened: number;      // timestamp
  progress: number;        // 0-100 percentage
  currentCfi?: string;     // reading position for EPUBs
  fileType: 'epub' | 'pdf';
  filePath?: string;       // file path for Electron (allows reopening without file picker)
}

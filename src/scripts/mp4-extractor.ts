/**
 * Utilities for extracting MP4 URLs from DASH manifests
 */

// Extract MP4 segments from a URL that contains them
export function extractMP4SegmentsFromURL(url: string): string[] | null {
    if (!url.includes('.mp4')) {
        return null;
    }
    
    try {
        // Look for pattern like: path/file_,123.mp4,456.mp4,789.mp4,.urlset/manifest.mpd
        const segmentMatch = url.match(/([^\/]+)_,([^,]+\.mp4),([^,]+\.mp4),([^,]+\.mp4),([^,]+\.mp4),([^,]+\.mp4),.urlset/);
        
        if (segmentMatch) {
            // Get the prefix
            const prefix = url.substring(0, url.indexOf(segmentMatch[1])) + segmentMatch[1] + '_';
            
            // Extract individual MP4 segments
            const segments: string[] = [];
            for (let i = 2; i < segmentMatch.length; i++) {
                if (segmentMatch[i].endsWith('.mp4')) {
                    segments.push(prefix + segmentMatch[i]);
                }
            }
            
            return segments.length > 0 ? segments : null;
        }
    } catch (e) {
        console.error("Error extracting MP4 segments:", e);
    }
    
    return null;
}

// Extract a direct MP4 URL from a DASH manifest XML
export function extractMP4URLFromManifest(manifestText: string, baseUrl: string): string | null {
    if (!manifestText) {
        return null;
    }
    
    try {
        // Try to find direct MP4 references
        const mp4Match = manifestText.match(/\s(https?:\/\/[^"'\s]+\.mp4)/);
        if (mp4Match && mp4Match[1]) {
            return mp4Match[1];
        }
        
        // Try to find BaseURL references
        const baseUrlMatch = manifestText.match(/<BaseURL>([^<]+)<\/BaseURL>/);
        if (baseUrlMatch && baseUrlMatch[1]) {
            let mp4Url = baseUrlMatch[1];
            
            // Handle relative URLs
            if (!mp4Url.startsWith('http')) {
                const manifestBaseUrl = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
                mp4Url = manifestBaseUrl + mp4Url;
            }
            
            return mp4Url;
        }
    } catch (e) {
        console.error("Error parsing manifest for MP4 URLs:", e);
    }
    
    return null;
}
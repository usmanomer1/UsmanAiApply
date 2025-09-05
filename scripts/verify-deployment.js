#!/usr/bin/env node

/**
 * Deployment Verification Script
 * 
 * This script verifies that all JavaScript chunks are properly deployed
 * and accessible at the expected URLs. It helps catch deployment issues
 * that could cause dynamic import failures.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DIST_DIR = join(__dirname, '..', 'dist');
const ASSETS_DIR = join(DIST_DIR, 'assets');

async function verifyDeployment(baseUrl = 'https://portal.jobotic.ai') {
  console.log('🔍 Verifying deployment...');
  console.log(`📍 Base URL: ${baseUrl}`);
  
  // Check if dist directory exists
  if (!existsSync(DIST_DIR)) {
    console.error('❌ dist directory not found. Please run "npm run build" first.');
    process.exit(1);
  }

  // Read the main index.html to find chunk references
  const indexPath = join(DIST_DIR, 'index.html');
  if (!existsSync(indexPath)) {
    console.error('❌ index.html not found in dist directory.');
    process.exit(1);
  }

  const indexContent = readFileSync(indexPath, 'utf-8');
  
  // Extract all JS and CSS asset references from index.html
  const assetMatches = [
    ...indexContent.matchAll(/\/assets\/[^"']+\.(js|css)/g)
  ];
  
  const assets = assetMatches.map(match => match[0]);
  
  console.log(`📦 Found ${assets.length} assets in index.html`);
  
  let allGood = true;
  const results = [];
  
  for (const asset of assets) {
    const localPath = join(DIST_DIR, asset.slice(1)); // Remove leading /
    const remoteUrl = `${baseUrl}${asset}`;
    
    // Check if file exists locally
    const existsLocally = existsSync(localPath);
    
    let remoteStatus = 'unknown';
    try {
      const response = await fetch(remoteUrl, { method: 'HEAD' });
      remoteStatus = response.ok ? 'ok' : `error-${response.status}`;
    } catch (error) {
      remoteStatus = 'fetch-failed';
    }
    
    const status = existsLocally && remoteStatus === 'ok' ? '✅' : '❌';
    
    results.push({
      asset,
      existsLocally,
      remoteStatus,
      status
    });
    
    if (!existsLocally || remoteStatus !== 'ok') {
      allGood = false;
    }
    
    console.log(`${status} ${asset} (local: ${existsLocally ? 'exists' : 'missing'}, remote: ${remoteStatus})`);
  }
  
  // Check for any .js files in assets that might not be referenced in index.html
  if (existsSync(ASSETS_DIR)) {
    const { readdirSync } = await import('fs');
    const allFiles = readdirSync(ASSETS_DIR);
    const jsFiles = allFiles.filter(f => f.endsWith('.js'));
    const referencedFiles = assets.map(a => a.split('/').pop());
    
    const unreferencedFiles = jsFiles.filter(f => !referencedFiles.includes(f));
    
    if (unreferencedFiles.length > 0) {
      console.log('\n📋 Additional JS files found (may be lazy-loaded chunks):');
      for (const file of unreferencedFiles) {
        const remoteUrl = `${baseUrl}/assets/${file}`;
        try {
          const response = await fetch(remoteUrl, { method: 'HEAD' });
          const status = response.ok ? '✅' : '❌';
          console.log(`${status} /assets/${file} (${response.ok ? 'accessible' : `error-${response.status}`})`);
          
          if (!response.ok) {
            allGood = false;
          }
        } catch (error) {
          console.log(`❌ /assets/${file} (fetch-failed)`);
          allGood = false;
        }
      }
    }
  }
  
  console.log('\n' + '='.repeat(50));
  
  if (allGood) {
    console.log('✅ All assets are properly deployed and accessible!');
    process.exit(0);
  } else {
    console.log('❌ Some assets are missing or inaccessible.');
    console.log('\n🔧 Possible fixes:');
    console.log('1. Ensure all files in dist/ are uploaded to the server');
    console.log('2. Check server configuration for /assets/* routing');
    console.log('3. Verify CDN cache is not serving stale files');
    console.log('4. Clear deployment cache and redeploy');
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const baseUrl = args[0] || 'https://portal.jobotic.ai';

verifyDeployment(baseUrl).catch(error => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});
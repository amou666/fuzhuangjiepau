const fs = require('fs');
const path = require('path');

const pages = [
  { src: 'frontend/src/pages/admin/Dashboard.tsx', dst: 'fashion-app/src/app/(admin)/dashboard/page.tsx' },
  { src: 'frontend/src/pages/admin/Customers.tsx', dst: 'fashion-app/src/app/(admin)/customers/page.tsx' },
  { src: 'frontend/src/pages/admin/Credits.tsx', dst: 'fashion-app/src/app/(admin)/credits/page.tsx' },
  { src: 'frontend/src/pages/admin/Records.tsx', dst: 'fashion-app/src/app/(admin)/records/page.tsx' },
  { src: 'frontend/src/pages/admin/AuditLogs.tsx', dst: 'fashion-app/src/app/(admin)/audit-logs/page.tsx' },
  { src: 'frontend/src/pages/app/Workspace.tsx', dst: 'fashion-app/src/app/(app)/workspace/page.tsx' },
  { src: 'frontend/src/pages/app/History.tsx', dst: 'fashion-app/src/app/(app)/history/page.tsx' },
  { src: 'frontend/src/pages/app/Profile.tsx', dst: 'fashion-app/src/app/(app)/profile/page.tsx' },
];

const base = 'c:\\Users\\lenovo\\CodeBuddy\\服装街拍\\fuzhuangjiepau';

pages.forEach(({ src, dst }) => {
  const srcPath = path.join(base, src);
  const dstPath = path.join(base, dst);
  
  if (!fs.existsSync(srcPath)) {
    console.log('SKIP (not found):', srcPath);
    return;
  }
  
  let content = fs.readFileSync(srcPath, 'utf8');
  
  // Add 'use client' at top
  if (!content.startsWith("'use client'")) {
    content = "'use client'\n\n" + content;
  }
  
  // Fix imports: ../../api/ -> @/lib/api/, ../../stores/ -> @/lib/stores/, etc.
  content = content.replace(/from '\.\.\/\.\.\/api\//g, "from '@/lib/api/");
  content = content.replace(/from '\.\.\/\.\.\/stores\//g, "from '@/lib/stores/");
  content = content.replace(/from '\.\.\/\.\.\/types'/g, "from '@/lib/types'");
  content = content.replace(/from '\.\.\/\.\.\/utils\//g, "from '@/lib/utils/");
  content = content.replace(/from '\.\.\/\.\.\/hooks\//g, "from '@/lib/hooks/");
  content = content.replace(/from '\.\.\/\.\.\/components\//g, "from '@/lib/components/");
  
  // Remove react-router-dom imports (we use next/navigation)
  content = content.replace(/import \{[^}]*\} from 'react-router-dom';?\n?/g, '');
  
  // Replace useNavigate with useRouter
  content = content.replace(/const navigate = useNavigate\(\);?\n?/g, '');
  content = content.replace(/navigate\(['"]([^'"]+)['"][^)]*\)/g, "router.push('$1')");
  
  // Replace Link with next/link
  content = content.replace(/import \{ Link \} from 'react-router-dom'/g, "import Link from 'next/link'");
  
  // Add useRouter import if navigate was used
  if (content.includes('router.push')) {
    if (!content.includes("from 'next/navigation'")) {
      content = content.replace("'use client'", "'use client'\n\nimport { useRouter } from 'next/navigation'");
    }
  }
  
  // Ensure useRouter is initialized
  if (content.includes('router.push') && !content.includes('const router = useRouter()')) {
    content = content.replace(/export default function (\w+)\(\)/, "export default function $1() {\n  const router = useRouter()");
    // Fix double opening brace
    content = content.replace(/const router = useRouter\(\)\n\{/, "const router = useRouter()");
  }
  
  // Create directory and write file
  fs.mkdirSync(path.dirname(dstPath), { recursive: true });
  fs.writeFileSync(dstPath, content);
  console.log('Created:', dst);
});

console.log('Done!');

const fs = require('fs');
const path = require('path');

function walk(dir) {
  fs.readdirSync(dir).forEach(f => {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.ts') || f.endsWith('.tsx')) {
      let c = fs.readFileSync(p, 'utf8');
      const orig = c;
      c = c.replace(/from '\.\.\/\.\.\/types'/g, "from '@/lib/types'");
      c = c.replace(/from '\.\.\/\.\.\/stores\//g, "from '@/lib/stores/");
      c = c.replace(/from '\.\.\/\.\.\/api\//g, "from '@/lib/api/");
      c = c.replace(/from '\.\.\/\.\.\/hooks\//g, "from '@/lib/hooks/");
      c = c.replace(/from '\.\.\/\.\.\/utils\//g, "from '@/lib/utils/");
      c = c.replace(/from '\.\.\/common\//g, "from '@/lib/components/common/");
      c = c.replace(/from '\.\.\/GlobalNotifications'/g, "from '@/lib/components/GlobalNotifications'");
      if (c !== orig) {
        fs.writeFileSync(p, c);
        console.log('Fixed:', p);
      }
    }
  });
}

walk('src/lib');

import { motion } from 'framer-motion';
import { Link2, Code, Palette, Brain, Megaphone } from 'lucide-react';

const teamMembers = [
  {
    name: 'Samarth Kapdi',
    role: 'Team Lead & UI/UX Designer',
    img: '/WhatsApp%20Image%202026-04-04%20at%202.23.02%20PM.jpeg',
    linkedin: 'https://www.linkedin.com/in/samarthkapdi/',
    icon: Code,
    accent: 'from-blue-500 to-blue-700',
  },
  {
    name: 'Ashish Parihar',
    role: 'Backend Developer & DevOps & System Architect',
    img: '/WhatsApp%20Image%202026-04-04%20at%202.36.56%20PM.jpeg',
    linkedin: 'https://www.linkedin.com/in/ashish-parihar-96b2b83b1/',
    icon: Megaphone,
    accent: 'from-green-500 to-green-700',
  },
  {
    name: 'Nikhil Soni',
    role: 'Backend Lead',
    img: '/WhatsApp%20Image%202026-04-04%20at%202.23.07%20PM.jpeg',
    linkedin: 'https://www.linkedin.com/in/nikhilsoni111/',
    icon: Palette,
    accent: 'from-purple-500 to-purple-700',
  },
  {
    name: 'Rohit Rajure',
    role: 'QA & Testing',
    img: '/WhatsApp%20Image%202026-04-04%20at%202.23.11%20PM.jpeg',
    linkedin: 'https://www.linkedin.com/in/rohit-rajure-bb9508302/',
    icon: Megaphone,
    accent: 'from-green-500 to-green-700',
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

export default function OurTeam() {
  return (
    <div className="py-8 sm:py-12" id="team" style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '4rem 2rem' }}>
      {/* ── Hero ── */}
      <motion.div {...fadeUp} className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-6" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)' }}>
          Team FutureMinds
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-4" style={{ color: 'var(--text-primary)' }}>
          Meet Our <span style={{ color: 'var(--accent-blue)' }}>Team</span>
        </h1>
        <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
          We are a group of developers, designers, and innovators passionate
          about building products that make a real difference in people's lives.
        </p>
      </motion.div>

      {/* ── Team Grid ── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
        {teamMembers.map((member, i) => {
          const RoleIcon = member.icon;
          return (
            <motion.div
              key={member.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="glass overflow-hidden group rounded-2xl relative"
            >
              {/* Top accent bar */}
              <div className={`h-1.5 bg-gradient-to-r ${member.accent} absolute top-0 left-0 right-0`} />

              <div className="p-6 text-center mt-2">
                {/* Avatar */}
                <div className="relative w-28 h-28 mx-auto mb-5">
                  <div className="w-full h-full rounded-full overflow-hidden border-4 shadow-lg" style={{ borderColor: 'var(--bg-card)' }}>
                    <img
                      src={member.img}
                      alt={member.name}
                      onError={(e) => {
                         // Fallback if image not found
                         e.target.style.display = 'none';
                         e.target.parentElement.innerHTML = `<div style="width: 100%; height: 100%; background: var(--bg-surface); display: flex; align-items: center; justify-content: center; font-size: 2rem; color: var(--text-muted);">${member.name.charAt(0)}</div>`;
                      }}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  </div>
                  <div
                    className={`absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-br ${member.accent} flex items-center justify-center shadow-md`}
                  >
                    <RoleIcon className="h-4 w-4 text-white" />
                  </div>
                </div>

                {/* Info */}
                <h3 className="font-bold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>
                  {member.name}
                </h3>
                <p className="font-medium text-sm mb-4" style={{ color: 'var(--accent-blue)' }}>
                  {member.role}
                </p>

                {/* Social links */}
                <div className="flex items-center justify-center gap-2">
                  <a
                    href={member.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${member.name} LinkedIn`}
                    title="LinkedIn"
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-blue-500/10"
                    style={{ color: 'var(--text-muted)', background: 'var(--bg-surface)' }}
                  >
                    <Link2 className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Join Us Banner ── */}
      <motion.div
        {...fadeUp}
        className="rounded-3xl p-8 sm:p-12 text-center shadow-lg"
        style={{ background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))' }}
      >
        <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4">
          Want to Build With Us?
        </h3>
        <p className="text-white/80 max-w-xl mx-auto text-lg mb-6">
          We're always looking for passionate individuals who want to use their
          skills for social impact.
        </p>
      </motion.div>
    </div>
  );
}

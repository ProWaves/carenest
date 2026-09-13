import { useAuth } from '../context/AuthContext';
import AIChatbot from './AIChatbot';

/**
 * Only mounts <AIChatbot> when the current user is a parent (or when
 * nobody is logged in, matching the previous behavior of the chatbot).
 *
 * For every other role, returns null and never mounts AIChatbot — so
 * none of its hooks, refs, or effects run.
 *
 * ⚠️ Do not import AIChatbot directly in pages; import this gate instead.
 */
export default function AIChatbotGate(props) {
  const { user } = useAuth();
  const isParent = !user || user.role === 'parent';

  if (!isParent) return null;

  return <AIChatbot {...props} />;
}
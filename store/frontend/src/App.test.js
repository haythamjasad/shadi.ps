import { render } from '@testing-library/react';
import App from './App';

test('renders initial loading screen', () => {
  const { container } = render(<App />);
  expect(container.querySelector('.border-t-blue-600')).toBeInTheDocument();
});

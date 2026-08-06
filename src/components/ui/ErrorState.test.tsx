import { render, screen } from '@testing-library/react-native';
import { ApiError } from '../../api/client';
import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('distingue falta de conexão', () => {
    render(<ErrorState error={new ApiError(0, 'Sem conexão com o servidor.')} />);
    expect(screen.getByText('Sem conexão')).toBeTruthy();
  });

  it('distingue falha do servidor e não culpa o usuário', () => {
    render(<ErrorState error={new ApiError(500, 'Erro 500.')} />);
    expect(screen.getByText('O servidor tropeçou')).toBeTruthy();
    expect(screen.getByText(/Não foi culpa sua/)).toBeTruthy();
  });

  it('dá copy própria ao 404 em vez do genérico "Erro 404."', () => {
    render(<ErrorState error={new ApiError(404, 'Erro 404.')} />);
    expect(screen.getByText('Não encontramos isso')).toBeTruthy();
    expect(screen.queryByText('Erro 404.')).toBeNull();
  });

  it('mostra o endereço da API no 404 durante o desenvolvimento', () => {
    // __DEV__ é true sob jest — é o cenário em que a dica deve aparecer.
    render(<ErrorState error={new ApiError(404, 'Erro 404.')} />);
    expect(screen.getByText(/API: http/)).toBeTruthy();
  });

  it('repassa a mensagem do backend nos demais 4xx', () => {
    render(<ErrorState error={new ApiError(422, 'Informe o valor cobrado.')} />);
    expect(screen.getByText('Informe o valor cobrado.')).toBeTruthy();
  });

  it('trata erro que não é ApiError sem vazar detalhe técnico', () => {
    render(<ErrorState error={new TypeError('undefined is not a function')} />);
    expect(screen.getByText('Não deu certo')).toBeTruthy();
    expect(screen.queryByText(/undefined is not a function/)).toBeNull();
  });

  it('só oferece o botão de retry quando há o que retentar', () => {
    const { rerender } = render(<ErrorState error={new ApiError(0, 'x')} />);
    expect(screen.queryByText('Tentar de novo')).toBeNull();

    rerender(<ErrorState error={new ApiError(0, 'x')} onRetry={() => {}} />);
    expect(screen.getByText('Tentar de novo')).toBeTruthy();
  });
});

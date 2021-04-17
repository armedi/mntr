import util from 'util';
import { render, Text } from 'ink';

export const renderUI = (request: any) => {
  render(<Text>{util.inspect(request)}</Text>);
};

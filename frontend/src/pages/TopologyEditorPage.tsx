import React from 'react';
import { Box, Heading } from '@chakra-ui/react';
import { ReactFlowProvider } from 'reactflow';
import TopologyEditor from '../components/TopologyEditor';

const TopologyEditorPage: React.FC = () => {
  return (
    <Box height="calc(100vh - 100px)" width="100%">
      <Heading size="lg" mb={4}>Multi-Target Topology Editor</Heading>
      <Box height="calc(100% - 60px)" width="100%" borderWidth="1px" borderRadius="lg" overflow="hidden">
        <ReactFlowProvider>
          <TopologyEditor />
        </ReactFlowProvider>
      </Box>
    </Box>
  );
};

export default TopologyEditorPage;

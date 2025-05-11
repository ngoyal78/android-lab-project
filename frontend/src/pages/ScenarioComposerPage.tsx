import React from 'react';
import { Box, Heading, Text, Container, Breadcrumb, BreadcrumbItem, BreadcrumbLink } from '@chakra-ui/react';
import { ChevronRightIcon } from '@chakra-ui/icons';
import ScenarioComposer from '../components/ScenarioComposer';

const ScenarioComposerPage: React.FC = () => {
  return (
    <Container maxW="container.xl" py={5}>
      <Breadcrumb separator={<ChevronRightIcon color="gray.500" />} mb={4}>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Home</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <BreadcrumbLink href="#">Scenario Composer</BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>
      
      <Box mb={6}>
        <Heading size="lg" mb={2}>Scenario Composer</Heading>
        <Text color="gray.600">
          Create and execute test scenarios with simulated device conditions and actions.
        </Text>
      </Box>
      
      <ScenarioComposer />
    </Container>
  );
};

export default ScenarioComposerPage;

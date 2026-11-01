package com.ams.assignment.service;
import com.ams.assignment.dto.AssignmentDtos.*;
import com.ams.assignment.entity.Course;
import com.ams.assignment.exception.AssignmentException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validation;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import java.net.http.*;
import java.util.List;
import java.util.Map;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.assertj.core.api.Assertions.*;

class GeminiAiServiceTest {
    AssignmentService assignments;
    HttpClient client;
    HttpResponse<String> response;
    GeminiAiService service;
    ValidatorFactory factory;
    ObjectMapper json=new ObjectMapper();
    final Generate request=new Generate(1,"REST API","Medium");
    final UsernamePasswordAuthenticationToken auth=new UsernamePasswordAuthenticationToken(1,null,List.of());
    @BeforeEach @SuppressWarnings("unchecked") void setup() throws Exception {
        assignments=mock(AssignmentService.class); client=mock(HttpClient.class); response=mock(HttpResponse.class);
        Course c=new Course(); c.setTitle("Java"); when(assignments.subject(1,auth)).thenReturn(c);
        factory=Validation.buildDefaultValidatorFactory(); service=new GeminiAiService("test-key","test-model",assignments,json,factory.getValidator(),client);
        when(client.send(any(HttpRequest.class),org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<String>>any())).thenReturn(response);
        when(response.statusCode()).thenReturn(200);
    }
    @AfterEach void close() { factory.close(); }
    String envelope(String draft) throws Exception { return json.writeValueAsString(Map.of("candidates",List.of(Map.of("content",Map.of("parts",List.of(Map.of("text",draft))))))); }
    @Test void validDraftIsReturnedWithoutSaving() throws Exception {
        when(response.body()).thenReturn(envelope("{\"title\":\"API\",\"description\":\"Build API\",\"rubric\":[{\"criteria\":\"Code\",\"description\":\"Works\",\"weight\":100}]}"));
        Draft draft=service.generate(request,auth); assertThat(draft.model()).isEqualTo("test-model"); assertThat(draft.rubric()).hasSize(1);
        verify(assignments).validateRubric(anyList()); verify(assignments,never()).save(any(),any(),any());
    }
    @Test void timeoutBecomes504() throws Exception {
        when(client.send(any(HttpRequest.class),org.mockito.ArgumentMatchers.<HttpResponse.BodyHandler<String>>any())).thenThrow(new HttpTimeoutException("timeout"));
        assertThatThrownBy(()->service.generate(request,auth)).isInstanceOfSatisfying(AssignmentException.class,e->assertThat(e.getStatus()).isEqualTo(504));
    }
    @Test void malformedAndBlockedOutputBecome502() throws Exception {
        for(String output:List.of("{}", "{\"candidates\":[]}", "invalid")) {
            when(response.body()).thenReturn(output);
            assertThatThrownBy(()->service.generate(request,auth)).isInstanceOfSatisfying(AssignmentException.class,e->assertThat(e.getStatus()).isEqualTo(502));
        }
    }
    @Test void invalidGeneratedFieldsAreRejected() throws Exception {
        when(response.body()).thenReturn(envelope("{\"title\":\"\",\"description\":\"API\",\"rubric\":[]}"));
        assertThatThrownBy(()->service.generate(request,auth)).isInstanceOfSatisfying(AssignmentException.class,e->assertThat(e.getStatus()).isEqualTo(502));
    }
    @Test void upstreamErrorDoesNotExposeResponseBody() throws Exception {
        when(response.statusCode()).thenReturn(429);
        assertThatThrownBy(()->service.generate(request,auth)).isInstanceOfSatisfying(AssignmentException.class,e->assertThat(e.getStatus()).isEqualTo(502));
        verify(response,never()).body();
    }
}
